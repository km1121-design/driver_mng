import { THRESHOLDS, driverLink } from "./config";
import { daysSince, daysUntil } from "./date";
import type { AlertKind, AlertLog, DailyReport, Driver, Vehicle } from "./types";

export type Severity = "critical" | "warning";

export type Alert = {
  key: string;
  kind: AlertKind;
  severity: Severity;
  driver: Driver | null;
  vehicle: Vehicle | null;
  /** 一覧に出す短い説明 */
  summary: string;
  /** 期限系: 残日数 (負数は超過) / オイル: 超過km / 未報告: 経過日数 */
  value: number | null;
  lastManualNotice: string | null;
};

function expirySummary(label: string, days: number) {
  return days < 0 ? `${label}が期限切れ (超過${-days}日)` : `${label}まで残り${days}日`;
}

function severityForDays(days: number): Severity {
  return days <= THRESHOLDS.expiryCriticalDays ? "critical" : "warning";
}

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
  const lastManual = (driverId: string | undefined, kind: AlertKind) =>
    logs
      .filter((l) => l.driver_id === driverId && l.kind === kind && l.channel === "manual")
      .map((l) => l.date)
      .sort()
      .at(-1) ?? null;

  const alerts: Alert[] = [];

  for (const d of activeDrivers) {
    const days = daysUntil(d.license_expiry);
    if (days !== null && days <= THRESHOLDS.expiryWarnDays) {
      alerts.push({
        key: `license:${d.id}`,
        kind: "license",
        severity: severityForDays(days),
        driver: d,
        vehicle: vehicles.find((v) => v.current_driver_id === d.id) ?? null,
        summary: expirySummary("免許証", days),
        value: days,
        lastManualNotice: lastManual(d.id, "license"),
      });
    }
  }

  for (const v of activeVehicles) {
    const driver = byId.get(v.current_driver_id) ?? null;
    for (const [kind, field, label] of [
      ["inspection", "inspection_expiry", "車検満了"],
      ["insurance", "insurance_expiry", "自賠責満了"],
    ] as const) {
      const days = daysUntil(v[field]);
      if (days !== null && days <= THRESHOLDS.expiryWarnDays) {
        alerts.push({
          key: `${kind}:${v.id}`,
          kind,
          severity: severityForDays(days),
          driver,
          vehicle: v,
          summary: expirySummary(label, days),
          value: days,
          lastManualNotice: lastManual(driver?.id, kind),
        });
      }
    }

    const sinceOil = v.current_mileage - v.last_oil_mileage;
    if (sinceOil >= THRESHOLDS.oilChangeKm) {
      alerts.push({
        key: `oil:${v.id}`,
        kind: "oil",
        severity: sinceOil >= THRESHOLDS.oilChangeKm * 1.2 ? "critical" : "warning",
        driver,
        vehicle: v,
        summary: `前回オイル交換から ${sinceOil.toLocaleString("ja-JP")}km 走行`,
        value: sinceOil,
        lastManualNotice: lastManual(driver?.id, "oil"),
      });
    }
  }

  // 未報告は「固定車両を持つ稼働中ドライバー」のみ対象 (共有車のアルバイトは乗務日のみ報告のため)
  for (const d of activeDrivers) {
    const hasFixed = vehicles.some(
      (v) => v.current_driver_id === d.id && v.usage_type === "fixed" && v.status !== "retired",
    );
    if (!hasFixed) continue;
    const last = reports
      .filter((r) => r.driver_id === d.id)
      .map((r) => r.date)
      .sort()
      .at(-1);
    const days = last ? daysSince(last) : null;
    if (days === null || days >= THRESHOLDS.unreportedDays) {
      alerts.push({
        key: `unreported:${d.id}`,
        kind: "unreported",
        severity: days === null || days >= THRESHOLDS.unreportedDays * 2 ? "critical" : "warning",
        driver: d,
        vehicle: vehicles.find((v) => v.current_driver_id === d.id) ?? null,
        summary: days === null ? "走行距離の報告履歴がありません" : `最終報告から${days}日経過`,
        value: days,
        lastManualNotice: lastManual(d.id, "unreported"),
      });
    }
  }

  const rank = (a: Alert) => (a.severity === "critical" ? 0 : 1);
  return alerts.sort((a, b) => rank(a) - rank(b));
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
      ? "運転免許証の更新期限が【超過】しております。\n至急、新しい免許証の写真（表・裏）をアップロードしてください。\n※免許が失効している場合は乗務できません。"
      : `運転免許証の有効期限が近づいています（残り${a.value}日）。\n更新後、新しい免許証の写真（表・裏）をアップロードしてください。`,
  inspection: (a) =>
    `担当車両（${a.vehicle?.plate}）の車検満了日が近づいています（${(a.value ?? 0) < 0 ? `超過${-(a.value ?? 0)}日` : `残り${a.value}日`}）。\n車検完了後、新しい車検証・記録事項の写真をアップロードしてください。`,
  insurance: (a) =>
    `担当車両（${a.vehicle?.plate}）の自賠責保険の満了日が近づいています。\n更新後、新しい保険証明書の写真をアップロードしてください。`,
  oil: (a) =>
    `担当車両（${a.vehicle?.plate}）は前回のオイル交換から ${a.value?.toLocaleString("ja-JP")}km 走行しています。\nオイル交換を実施し、レシート写真を添えて報告してください。`,
  unreported: () =>
    "走行距離の報告が2週間以上ありません。\n現在のメーター（走行距離）を報告してください。",
};

/** 管理画面のプレビュー / 手動送信で使うメッセージ本文 */
export function buildAlertMessage(a: Alert): string {
  const name = a.driver?.name ?? "ご担当者";
  const url = a.driver ? driverLink(a.driver.portal_token, PORTAL_PATH[a.kind]) : "";
  return `${name} さん
管理者です。

${BODY[a.kind](a)}

▼【${name}さん専用】提出フォーム
${url}

※このURLはご本人専用です。他の方と共有しないでください。

よろしくお願いいたします。`;
}
