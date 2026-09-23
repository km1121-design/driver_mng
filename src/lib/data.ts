import "server-only";
import { connection } from "next/server";
import { computeAlerts } from "./alerts";
import { getRepo } from "./repo";

export async function loadAll() {
  // 常にリクエスト時に最新データを取得する (静的プリレンダーさせない)
  await connection();
  const repo = getRepo();
  const [drivers, vehicles, reports, documents, defects, logs] = await Promise.all([
    repo.list("drivers"),
    repo.list("vehicles"),
    repo.list("daily_reports"),
    repo.list("documents"),
    repo.list("defect_reports"),
    repo.list("alert_logs"),
  ]);
  const alerts = computeAlerts({ drivers, vehicles, reports, logs });
  return { drivers, vehicles, reports, documents, defects, logs, alerts };
}

/** ポータルトークンからドライバーと担当車両を解決する。不正なら null */
export async function resolvePortal(token: string | undefined | null) {
  await connection();
  if (!token || token.length < 8) return null;
  const repo = getRepo();
  const drivers = await repo.list("drivers");
  const driver = drivers.find((d) => d.portal_token === token && d.status !== "retired");
  if (!driver) return null;
  const vehicles = await repo.list("vehicles");
  const vehicle =
    vehicles.find((v) => v.current_driver_id === driver.id && v.status !== "retired") ?? null;
  return { driver, vehicle };
}
