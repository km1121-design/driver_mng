"use server";

import { revalidatePath } from "next/cache";
import { planImport, type ImportKind, type ImportPlan } from "@/lib/import";
import { getRepo, newId, newPortalToken } from "@/lib/repo";
import type { Driver, Vehicle } from "@/lib/types";

// 管理画面のパスは proxy.ts の Basic 認証で保護されている。

const MAX_CHARS = 500_000;

async function plan(kind: ImportKind, text: string) {
  if (kind !== "drivers" && kind !== "vehicles") throw new Error("取り込み対象が不正です");
  if (text.length > MAX_CHARS) throw new Error("データが大きすぎます");
  const repo = getRepo();
  const [drivers, vehicles] = await Promise.all([repo.list("drivers"), repo.list("vehicles")]);
  return planImport(kind, text, { drivers, vehicles });
}

export async function previewImport(
  kind: ImportKind,
  text: string,
): Promise<{ ok: true; plan: ImportPlan } | { ok: false; message: string }> {
  try {
    return { ok: true, plan: await plan(kind, text) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "読み込みに失敗しました" };
  }
}

/** プレビューと同じ内容をサーバー側で計算し直して反映する (クライアントの値は信用しない) */
export async function commitImport(
  kind: ImportKind,
  text: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { rows } = await plan(kind, text);
    const repo = getRepo();
    const inserts = rows.filter((r) => r.action === "insert");
    const updates = rows.filter((r) => r.action === "update" && r.targetId);

    if (kind === "drivers") {
      await repo.insertMany(
        "drivers",
        inserts.map((r): Driver => ({
          id: newId("d"),
          name: "",
          type: "full_commission",
          status: "active",
          phone: "",
          email: "",
          emergency_contact_name: "",
          emergency_contact_phone: "",
          line_user_id: "",
          license_expiry: "",
          license_number: "",
          license_class: "",
          license_conditions: "",
          ...(r.fields as Partial<Driver>),
          portal_token: newPortalToken(),
        })),
      );
      await repo.updateMany("drivers", updates.map((r) => ({ id: r.targetId!, patch: r.fields as Partial<Driver> })));
    } else {
      await repo.insertMany(
        "vehicles",
        inserts.map((r): Vehicle => {
          const f = r.fields as Partial<Vehicle>;
          return {
            id: newId("v"),
            plate: "",
            car_type: "",
            usage_type: f.current_driver_id ? "fixed" : "shared",
            current_driver_id: "",
            status: "active",
            inspection_expiry: "",
            insurance_expiry: "",
            current_mileage: 0,
            last_oil_mileage: f.current_mileage ?? 0,
            ...f,
          };
        }),
      );
      await repo.updateMany("vehicles", updates.map((r) => ({ id: r.targetId!, patch: r.fields as Partial<Vehicle> })));
    }

    revalidatePath("/", "layout");
    const skipped = rows.length - inserts.length - updates.length;
    return {
      ok: true,
      message: `新規 ${inserts.length} 件・更新 ${updates.length} 件を取り込みました${skipped ? ` (エラーの ${skipped} 件は除外)` : ""}`,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: e instanceof Error ? e.message : "取り込みに失敗しました" };
  }
}
