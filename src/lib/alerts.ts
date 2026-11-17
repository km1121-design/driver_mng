import { THRESHOLDS, driverLink } from "./config";
import { daysUntil, todayJst } from "./date";
import type { AlertKind, AlertLog, DailyReport, Driver, Vehicle } from "./types";

export type Severity = "critical" | "warning";
/** 次に動くのは誰か。driver = 本人の対応待ち (自動通知に任せる) / admin = 管理者が確認する */
export type WaitingOn = "driver" | "admin";

export type Alert = {
  key: string;
  kind: AlertKind;
  severity: Severity;
  waitingOn: WaitingOn;
  driver: Driver | null;
  vehicle: Vehicle | null;
  /** 一覧に出す短い説明 */
  summary: string;
  /** waitingOn = admin のとき、管理者がすること */
  adminTask: string | null;
  /** 期限系: 残日数 (負数は超過) / オイル: 前回交換からの km / 未報告: 締め日からの経過日数 */
  value: number | null;
  /** 最後に LINE で知らせた日時 (自動・手動) */
  lastNotice: string | null;
  lastManualNotice: string | null;
};

function expirySummary(label: string, days: number) {
  return days < 0 ? `${label}を${-days}日過ぎています` : `${label}まで残り${days}日`;
}

function severityForDays(days: number): Severity {
  return days <= THRESHOLDS.expiryCriticalDays ? "critical" : "warning";
}

function expiryAdminTask(days: number, what: string): string | null {
  if (days < 0) return `期限切れです。乗務させる前に${what}を確認してください`;
  if (days <= THRESHOLDS.expiryEscalateDays) return `まだ更新の提出がありません。本人に${what}の予定を確認してください`;
  return null;
}

/* ---------- 走行距離 (月1回) ---------- */

/** JST の年月 (YYYY-MM) */
export function monthJst(iso: string | Date = new Date()) {
  return todayJst(typeof iso === "string" ? new Date(iso) : iso).slice(0, 7);
}

/** 月1回の走行距離報告の対象 (固定車両を持つ稼働中ドライバー。共有車のアルバイトは対象外) */
export function needsMonthlyMileage(driver: Driver, vehicles: Vehicle[]) {
  return (
    driver.status === "active" &&
    vehicles.some((v) => v.current_driver_id === driver.id && v.usage_type === "fixed" && v.status !== "retired")
  );
}

export type MileageStatus = {
  /** 今月の最新の報告日時。未報告なら null */
  reportedAt: string | null;
  /** 今月の締め日 (YYYY-MM-DD) */
  dueDate: string;
  /** 締め日を過ぎても今月の報告がない */
  overdue: boolean;
  /** 締め日からの経過日数 (締め前は 0 以下) */
  daysPastDue: number;
};

export function mileageStatus(driverId: string, reports: DailyReport[], now = new Date()): MileageStatus {
  const month = monthJst(now);
  const reportedAt =
    reports
      .filter((r) => r.driver_id === driverId && monthJst(r.date) === month)
      .map((r) => r.date)
      .sort()
      .at(-1) ?? null;
  const dueDate = `${month}-${String(THRESHOLDS.mileageDueDay).padStart(2, "0")}`;
  const daysPastDue = -(daysUntil(dueDate, now) ?? 0);
  return { reportedAt, dueDate, overdue: !reportedAt && daysPastDue > 0, daysPastDue };
}

/* ---------- アラート ---------- */

/** シートの生データから、対応が必要なアラート一覧を算出する */
export function computeAlerts(input: {
  drivers: Driver[];
  vehicles: Vehicle[];
  reports: DailyReport[];
  logs: AlertLog[];
}): Alert[] {
  const { drivers, vehicles, reports, logs } = input;
  const byId = new Map(drivers.map((d) => [d.id, d]));
  const activeDrivers = drivers.filter((d) => d.status === "active");
  const activeVehicles = vehicles.filter((v) => v.status !== "retired");
  const lastLog = (driverId: string | undefined, kind: AlertKind, channels: AlertLog["channel"][]) =>
    logs
      .filter((l) => l.driver_id === driverId && l.kind === kind && channels.includes(l.channel))
      .map((l) => l.date)
      .sort()
      .at(-1) ?? null;
  const notices = (driverId: string | undefined, kind: AlertKind) => ({
    lastNotice: lastLog(driverId, kind, ["auto", "manual"]),
    lastManualNotice: lastLog(driverId, kind, ["manual"]),
  });

  const alerts: Alert[] = [];

  for (const d of activeDrivers) {
    const days = daysUntil(d.license_expiry);
    if (days !== null && days <= THRESHOLDS.expiryWarnDays) {
      const adminTask = expiryAdminTask(days, "免許の更新");
      alerts.push({
        key: `license:${d.id}`,
        kind: "license",
        severity: severityForDays(days),
        waitingOn: adminTask ? "admin" : "driver",
        driver: d,
        vehicle: vehicles.find((v) => v.current_driver_id === d.id) ?? null,
        summary: expirySummary("免許証の有効期限", days),
        adminTask,
        value: days,
        ...notices(d.id, "license"),
      });
    }
  }

  for (const v of activeVehicles) {
    const driver = byId.get(v.current_driver_id) ?? null;
    for (const [kind, field, label, what] of [
      ["inspection", "inspection_expiry", "車検満了日", "車検"],
      ["insurance", "insurance_expiry", "自賠責満了日", "自賠責の更新"],
    ] as const) {
      const days = daysUntil(v[field]);
      if (days !== null && days <= THRESHOLDS.expiryWarnDays) {
        // 担当者がいない車両 (予備車など) は最初から管理者の担当
        const adminTask = expiryAdminTask(days, what) ?? (driver ? null : `担当ドライバーがいない車両です。${what}を手配してください`);
        alerts.push({
          key: `${kind}:${v.id}`,
          kind,
          severity: severityForDays(days),
          waitingOn: adminTask ? "admin" : "driver",
          driver,
          vehicle: v,
          summary: expirySummary(label, days),
          adminTask,
          value: days,
          ...notices(driver?.id, kind),
        });
      }
    }

    const sinceOil = v.current_mileage - v.last_oil_mileage;
    if (sinceOil >= THRESHOLDS.oilChangeKm) {
      const escalate = sinceOil >= THRESHOLDS.oilEscalateKm || !driver;
      alerts.push({
        key: `oil:${v.id}`,
        kind: "oil",
        severity: sinceOil >= THRESHOLDS.oilEscalateKm ? "critical" : "warning",
        waitingOn: escalate ? "admin" : "driver",
        driver,
        vehicle: v,
        summary: `前回オイル交換から ${sinceOil.toLocaleString("ja-JP")}km 走行`,
        adminTask: escalate ? "交換の報告がありません。オイル交換の予定を手配・確認してください" : null,
        value: sinceOil,
        ...notices(driver?.id, "oil"),
      });
    }
  }

  // 走行距離は月1回。締め日 (7日) までは本人の対応待ちとして通知に任せ、過ぎたら管理者へ
  for (const d of activeDrivers) {
    if (!needsMonthlyMileage(d, vehicles)) continue;
    const st = mileageStatus(d.id, reports);
    if (!st.overdue) continue;
    alerts.push({
      key: `unreported:${d.id}`,
      kind: "unreported",
      severity: "warning",
      waitingOn: "admin",
      driver: d,
      vehicle: vehicles.find((v) => v.current_driver_id === d.id) ?? null,
      summary: `今月の走行距離が未報告 (${THRESHOLDS.mileageDueDay}日締め)`,
      adminTask: "締め日を過ぎました。本人に報告を依頼してください",
      value: st.daysPastDue,
      ...notices(d.id, "unreported"),
    });
  }

  // 管理者の対応が必要なもの → 緊急 → 残日数の少ない順
  const rank = (a: Alert) => (a.waitingOn === "admin" ? 0 : 2) + (a.severity === "critical" ? 0 : 1);
  return alerts.sort((a, b) => rank(a) - rank(b) || (a.value ?? 0) - (b.value ?? 0));
}

const PORTAL_PATH: Record<AlertKind, string> = {
  license: "&tab=docs&doc=license",
  inspection: "&tab=docs&doc=vehicle",
  insurance: "&tab=docs&doc=vehicle",
  oil: "&tab=daily",
  unreported: "&tab=daily",
};

const BODY: Record<AlertKind, (a: Alert) => string> = {
  license: (a) =>
    (a.value ?? 0) < 0
      ? `運転免許証の有効期限が切れています（${-(a.value ?? 0)}日超過）。\n更新した免許証の写真（表・裏）を送ってください。\n※免許が失効している場合は乗務できません。`
      : `運転免許証の有効期限まで あと${a.value}日です。\n更新したら、新しい免許証の写真（表・裏）を送ってください。`,
  inspection: (a) =>
    `担当車両（${a.vehicle?.plate}）の車検満了日が近づいています（${(a.value ?? 0) < 0 ? `超過${-(a.value ?? 0)}日` : `残り${a.value}日`}）。\n車検完了後、新しい車検証・記録事項の写真をアップロードしてください。`,
  insurance: (a) =>
    `担当車両（${a.vehicle?.plate}）の自賠責保険の満了日が近づいています。\n更新後、新しい保険証明書の写真をアップロードしてください。`,
  oil: (a) =>
    `担当車両（${a.vehicle?.plate}）は前回のオイル交換から ${a.value?.toLocaleString("ja-JP")}km 走行しています。\nオイル交換を実施し、レシート写真を添えて報告してください。`,
  unreported: () =>
    `今月の走行距離の報告がまだです（毎月${THRESHOLDS.mileageDueDay}日まで）。\n現在のメーター（走行距離）を報告してください。`,
};

/** 管理画面のプレビュー / 手動送信で使うメッセージ本文 (GAS の dailyNotify と同じ形) */
export function buildAlertMessage(a: Alert): string {
  const name = a.driver?.name ?? "ご担当者";
  const url = a.driver ? driverLink(a.driver.portal_token, PORTAL_PATH[a.kind]) : "";
  const tokenNote = process.env.LIFF_ID ? "" : "\n\n※このURLはご本人専用です。他の方と共有しないでください。";
  return `${name} さん
おつかれさまです。管理者です。

${BODY[a.kind](a)}

▼ここから開けます（メニューの「車両管理」からも開けます）
${url}${tokenNote}`;
}
