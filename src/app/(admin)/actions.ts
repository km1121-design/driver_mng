"use server";

import { revalidatePath } from "next/cache";
import { buildAlertMessage } from "@/lib/alerts";
import { fail, isYmd, str, type ActionResult } from "@/lib/action-result";
import { loadAll } from "@/lib/data";
import { pushLineMessage } from "@/lib/line";
import { getRepo, newId, newPortalToken } from "@/lib/repo";
import { runOcr, type OcrResult } from "@/lib/gemini";
import { saveFile, validateUpload } from "@/lib/storage";
import {
  DRIVER_STATUS_LABEL,
  DRIVER_TYPE_LABEL,
  USAGE_TYPE_LABEL,
  VEHICLE_STATUS_LABEL,
  type DocType,
  type Driver,
  type DriverStatus,
  type DriverType,
  type Vehicle,
  type VehicleStatus,
  type VehicleUsageType,
} from "@/lib/types";

// 管理画面のパスは proxy.ts の Basic 認証で保護されている。

function revalidateAdmin() {
  revalidatePath("/", "layout");
}

export async function saveDriver(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const id = str(form, "id");
    const name = str(form, "name");
    const type = str(form, "type") as DriverType;
    const status = str(form, "status") as DriverStatus;
    const licenseExpiry = str(form, "license_expiry");
    if (!name) return { ok: false, message: "氏名を入力してください" };
    if (!(type in DRIVER_TYPE_LABEL) || !(status in DRIVER_STATUS_LABEL)) {
      return { ok: false, message: "区分・ステータスが不正です" };
    }
    if (licenseExpiry && !isYmd(licenseExpiry)) {
      return { ok: false, message: "免許有効期限の形式が不正です" };
    }
    const fields = {
      name,
      type,
      status,
      phone: str(form, "phone"),
      email: str(form, "email"),
      emergency_contact_name: str(form, "emergency_contact_name"),
      emergency_contact_phone: str(form, "emergency_contact_phone"),
      line_user_id: str(form, "line_user_id"),
      license_expiry: licenseExpiry,
      license_number: str(form, "license_number").replace(/[^0-9]/g, ""),
      license_class: str(form, "license_class"),
      license_conditions: str(form, "license_conditions"),
    } satisfies Partial<Driver>;

    const repo = getRepo();
    if (id) {
      await repo.update("drivers", id, fields);
    } else {
      await repo.insert("drivers", { id: newId("d"), portal_token: newPortalToken(), ...fields });
    }
    revalidateAdmin();
    return { ok: true, message: id ? "ドライバー情報を更新しました" : "ドライバーを登録しました" };
  } catch (e) {
    return fail(e);
  }
}

export async function regeneratePortalToken(driverId: string): Promise<ActionResult> {
  try {
    await getRepo().update("drivers", driverId, { portal_token: newPortalToken() });
    revalidateAdmin();
    return { ok: true, message: "ポータルURLを再発行しました。旧URLは無効になります" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveVehicle(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const id = str(form, "id");
    const plate = str(form, "plate");
    const usage = str(form, "usage_type") as VehicleUsageType;
    const status = str(form, "status") as VehicleStatus;
    const inspection = str(form, "inspection_expiry");
    const insurance = str(form, "insurance_expiry");
    const mileage = Number(str(form, "current_mileage") || 0);
    const lastOil = Number(str(form, "last_oil_mileage") || 0);
    if (!plate) return { ok: false, message: "ナンバーを入力してください" };
    if (!(usage in USAGE_TYPE_LABEL) || !(status in VEHICLE_STATUS_LABEL)) {
      return { ok: false, message: "区分・ステータスが不正です" };
    }
    for (const d of [inspection, insurance]) {
      if (d && !isYmd(d)) return { ok: false, message: "日付の形式が不正です" };
    }
    if (!Number.isFinite(mileage) || mileage < 0 || !Number.isFinite(lastOil) || lastOil < 0) {
      return { ok: false, message: "走行距離が不正です" };
    }
    const fields = {
      plate,
      car_type: str(form, "car_type"),
      usage_type: usage,
      current_driver_id: str(form, "current_driver_id"),
      status,
      inspection_expiry: inspection,
      insurance_expiry: insurance,
      current_mileage: mileage,
      last_oil_mileage: lastOil,
    } satisfies Partial<Vehicle>;

    const repo = getRepo();
    if (id) {
      await repo.update("vehicles", id, fields);
    } else {
      await repo.insert("vehicles", { id: newId("v"), ...fields });
    }
    revalidateAdmin();
    return { ok: true, message: id ? "車両情報を更新しました" : "車両を登録しました" };
  } catch (e) {
    return fail(e);
  }
}

/** 管理者による車検証・記録事項・自賠責の事後アップロード */
export async function adminUploadVehicleDoc(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const vehicleId = str(form, "vehicle_id");
    const docType = str(form, "doc_type");
    const expiry = str(form, "expiry");
    const file = form.get("file");
    if (!["inspection_cert", "inspection_record", "insurance_cert"].includes(docType)) {
      return { ok: false, message: "書類種別が不正です" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "ファイルを選択してください" };
    }
    if (expiry && !isYmd(expiry)) return { ok: false, message: "満了日の形式が不正です" };

    const repo = getRepo();
    const vehicle = (await repo.list("vehicles")).find((v) => v.id === vehicleId);
    if (!vehicle) return { ok: false, message: "車両が見つかりません" };

    const fileUrl = await saveFile(file, `${vehicle.plate}_${docType}`);
    await repo.insert("documents", {
      id: newId("doc"),
      date: new Date().toISOString(),
      driver_id: vehicle.current_driver_id,
      vehicle_id: vehicle.id,
      doc_type: docType as "inspection_cert" | "inspection_record" | "insurance_cert",
      file_url: fileUrl,
      parsed_expiry_date: expiry,
      uploaded_by: "admin",
    });
    if (expiry) {
      await repo.update(
        "vehicles",
        vehicle.id,
        docType === "insurance_cert" ? { insurance_expiry: expiry } : { inspection_expiry: expiry },
      );
    }
    revalidateAdmin();
    return { ok: true, message: expiry ? "アップロードし、満了日を更新しました" : "アップロードしました" };
  } catch (e) {
    return fail(e);
  }
}

/** 自動通知に反応しないドライバーへ、管理者が手動で LINE を送る */
export async function sendManualAlert(alertKey: string): Promise<ActionResult> {
  try {
    const { alerts } = await loadAll();
    const alert = alerts.find((a) => a.key === alertKey);
    if (!alert) return { ok: false, message: "対象のアラートは既に解消されています" };
    if (!alert.driver) return { ok: false, message: "担当ドライバーが未割当のため送信できません" };

    const { demo } = await pushLineMessage(alert.driver.line_user_id, buildAlertMessage(alert));
    await getRepo().insert("alert_logs", {
      id: newId("log"),
      date: new Date().toISOString(),
      driver_id: alert.driver.id,
      kind: alert.kind,
      channel: "manual",
    });
    revalidateAdmin();
    return {
      ok: true,
      message: demo
        ? `${alert.driver.name} さんへ送信しました (デモ: LINE未設定のためログ出力のみ)`
        : `${alert.driver.name} さんへ LINE を送信しました`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveDefect(id: string): Promise<ActionResult> {
  try {
    await getRepo().update("defect_reports", id, { status: "resolved" });
    revalidateAdmin();
    return { ok: true, message: "対応済みにしました" };
  } catch (e) {
    return fail(e);
  }
}

/** 管理者アップロード時に満了日を自動入力するための OCR */
export async function adminOcr(form: FormData): Promise<OcrResult | { error: string }> {
  try {
    const docType = str(form, "doc_type") as DocType;
    const file = form.get("file");
    if (!(file instanceof File)) return { error: "ファイルがありません" };
    validateUpload(file);
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return await runOcr(docType, { mimeType: file.type, base64 });
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : "読み取りに失敗しました" };
  }
}
