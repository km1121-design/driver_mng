"use server";

import { revalidatePath } from "next/cache";
import { fail, isYmd, str, type ActionResult } from "@/lib/action-result";
import { APP_BASE_URL } from "@/lib/config";
import { resolvePortal } from "@/lib/data";
import { notifyAdmin } from "@/lib/line";
import { getRepo, newId } from "@/lib/repo";
import { saveFile } from "@/lib/storage";
import type { DocType } from "@/lib/types";

// すべてのポータル操作は毎回トークンを検証してからドライバーを特定する。
// クライアントから driver_id / vehicle_id は受け取らない。

async function auth(form: FormData) {
  const portal = await resolvePortal(str(form, "token"));
  if (!portal) throw new Error("URLが無効です。管理者に新しいURLを依頼してください");
  return portal;
}

function file(form: FormData, key: string): File | null {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

export async function submitDailyReport(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { driver, vehicle } = await auth(form);
    if (!vehicle) return { ok: false, message: "担当車両が割り当てられていません。管理者に連絡してください" };

    const mileage = Number(str(form, "mileage").replaceAll(",", ""));
    if (!Number.isInteger(mileage) || mileage <= 0) {
      return { ok: false, message: "走行距離を正しく入力してください" };
    }
    if (mileage < vehicle.current_mileage) {
      return {
        ok: false,
        message: `前回報告 (${vehicle.current_mileage.toLocaleString("ja-JP")} km) より小さい値です。メーターを再確認してください`,
      };
    }
    if (mileage - vehicle.current_mileage > 5000) {
      if (str(form, "confirm_large") !== "1") {
        return { ok: false, message: "前回から5,000km以上増えています。値が正しければもう一度送信してください" };
      }
    }
    const oil = form.get("is_oil_changed") === "on";
    const photo = file(form, "oil_photo");
    if (oil && !photo) return { ok: false, message: "オイル交換のレシート等の写真を添付してください" };

    const photoUrl = photo ? await saveFile(photo, `${vehicle.plate}_oil_${driver.name}`) : "";
    const repo = getRepo();
    await repo.insert("daily_reports", {
      id: newId("r"),
      date: new Date().toISOString(),
      driver_id: driver.id,
      vehicle_id: vehicle.id,
      mileage,
      is_oil_changed: oil,
      tire_ok: form.get("tire_ok") === "on",
      lights_brakes_ok: form.get("lights_brakes_ok") === "on",
      photo_url: photoUrl,
    });
    await repo.update("vehicles", vehicle.id, {
      current_mileage: mileage,
      ...(oil ? { last_oil_mileage: mileage } : {}),
    });
    const tireOk = form.get("tire_ok") === "on";
    const lightsOk = form.get("lights_brakes_ok") === "on";
    if (!tireOk || !lightsOk) {
      const ng = [!tireOk && "タイヤ", !lightsOk && "ランプ類・ブレーキ"].filter(Boolean).join("・");
      await notifyAdmin(
        `【要確認】状態チェックで異常の報告がありました
${driver.name} さん / ${vehicle.plate}
項目: ${ng}
${mileage.toLocaleString("ja-JP")} km
${APP_BASE_URL}/`,
      );
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "定期報告を送信しました。ありがとうございます！" };
  } catch (e) {
    return fail(e);
  }
}

const VEHICLE_DOCS: DocType[] = ["inspection_cert", "inspection_record", "insurance_cert"];

/**
 * 書類提出。OCR 結果はドライバーが画面上で確認・修正した値 (expiry_*) を受け取り反映する。
 */
export async function submitDocuments(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { driver, vehicle } = await auth(form);
    const group = str(form, "group");
    const repo = getRepo();

    if (group === "license") {
      const front = file(form, "license_front");
      const back = file(form, "license_back");
      const expiry = str(form, "expiry_license");
      if (!front || !back) return { ok: false, message: "免許証の表面・裏面の両方を撮影してください" };
      if (!isYmd(expiry)) return { ok: false, message: "有効期限を確認・入力してください" };
      for (const [type, f] of [["license_front", front], ["license_back", back]] as const) {
        const url = await saveFile(f, `${driver.name}_${type}`);
        await repo.insert("documents", {
          id: newId("doc"),
          date: new Date().toISOString(),
          driver_id: driver.id,
          vehicle_id: "",
          doc_type: type,
          file_url: url,
          parsed_expiry_date: type === "license_front" ? expiry : "",
          uploaded_by: "driver",
        });
      }
      await repo.update("drivers", driver.id, { license_expiry: expiry });
    } else if (group === "vehicle") {
      if (!vehicle) return { ok: false, message: "担当車両が割り当てられていません" };
      const files = VEHICLE_DOCS.map((t) => [t, file(form, t)] as const).filter(([, f]) => f);
      if (files.length === 0) return { ok: false, message: "提出する書類を1つ以上撮影してください" };
      const inspection = str(form, "expiry_inspection");
      const insurance = str(form, "expiry_insurance");
      for (const d of [inspection, insurance]) {
        if (d && !isYmd(d)) return { ok: false, message: "満了日の形式が不正です" };
      }
      for (const [type, f] of files) {
        const url = await saveFile(f!, `${vehicle.plate}_${type}`);
        await repo.insert("documents", {
          id: newId("doc"),
          date: new Date().toISOString(),
          driver_id: driver.id,
          vehicle_id: vehicle.id,
          doc_type: type,
          file_url: url,
          parsed_expiry_date:
            type === "insurance_cert" ? insurance : type === "inspection_record" ? inspection : "",
          uploaded_by: "driver",
        });
      }
      await repo.update("vehicles", vehicle.id, {
        ...(inspection ? { inspection_expiry: inspection } : {}),
        ...(insurance ? { insurance_expiry: insurance } : {}),
      });
    } else {
      return { ok: false, message: "書類種別が不正です" };
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "書類を提出しました。ありがとうございます！" };
  } catch (e) {
    return fail(e);
  }
}

export async function updateContact(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { driver } = await auth(form);
    const phone = str(form, "phone");
    if (!phone) return { ok: false, message: "携帯電話番号を入力してください" };
    await getRepo().update("drivers", driver.id, {
      phone,
      email: str(form, "email"),
      emergency_contact_name: str(form, "emergency_contact_name"),
      emergency_contact_phone: str(form, "emergency_contact_phone"),
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "連絡先を更新しました" };
  } catch (e) {
    return fail(e);
  }
}

export async function submitDefect(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { driver, vehicle } = await auth(form);
    const location = str(form, "location");
    if (!location) return { ok: false, message: "損傷・不具合の箇所を入力してください" };
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (photos.length > 5) return { ok: false, message: "写真は5枚までです" };
    const urls: string[] = [];
    for (const [i, p] of photos.entries()) {
      urls.push(await saveFile(p, `${vehicle?.plate ?? driver.name}_defect_${i + 1}`));
    }
    await getRepo().insert("defect_reports", {
      id: newId("x"),
      date: new Date().toISOString(),
      driver_id: driver.id,
      vehicle_id: vehicle?.id ?? "",
      location,
      note: str(form, "note"),
      photo_urls: urls.join("\n"),
      status: "open",
    });
    await notifyAdmin(
      `【車両報告】${driver.name} さん / ${vehicle?.plate ?? "車両不明"}
箇所: ${location}${urls.length ? `\n写真: ${urls.length}枚` : ""}
${APP_BASE_URL}/defects`,
    );
    revalidatePath("/", "layout");
    return { ok: true, message: "管理者に報告を送信しました" };
  } catch (e) {
    return fail(e);
  }
}
