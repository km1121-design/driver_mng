import { computeAlerts, mileageStatus, needsMonthlyMileage, type MileageStatus } from "./alerts";
import { THRESHOLDS } from "./config";
import type { DailyReport, Driver, Vehicle } from "./types";

// ドライバー画面の「今やること」。アラート判定 (alerts.ts) と同じ基準で、本人向けの言葉にする。

export type TodoTarget = { tab: "daily" | "docs"; doc?: "license" | "vehicle" };

export type DriverTodo = {
  key: string;
  icon: "license" | "vehicle" | "oil" | "mileage";
  title: string;
  detail: string;
  /** red: 期限切れ・締め切り超過など急ぎ / amber: 近い / blue: 通常 */
  tone: "red" | "amber" | "blue";
  cta: string;
  target: TodoTarget;
};

function md(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}月${d}日`;
}

function expiryDetail(label: string, days: number) {
  return days < 0 ? `${label}が切れています（${-days}日超過）` : `${label}まで あと${days}日`;
}

export function driverTodos(input: {
  driver: Driver;
  vehicles: Vehicle[];
  reports: DailyReport[];
}): { todos: DriverTodo[]; mileage: MileageStatus | null } {
  const { driver, vehicles, reports } = input;
  const alerts = computeAlerts({ drivers: [driver], vehicles, reports, logs: [] }).filter(
    (a) => a.driver?.id === driver.id && a.kind !== "unreported",
  );
  const todos: DriverTodo[] = [];
  const tone = (days: number) => (days < 0 ? "red" : days <= THRESHOLDS.expiryCriticalDays ? "amber" : "blue");

  for (const a of alerts) {
    const days = a.value ?? 0;
    if (a.kind === "license") {
      todos.push({
        key: a.key,
        icon: "license",
        title: "運転免許証の更新",
        detail: expiryDetail("有効期限", days),
        tone: tone(days),
        cta: "新しい免許証を撮影する",
        target: { tab: "docs", doc: "license" },
      });
    } else if (a.kind === "inspection" || a.kind === "insurance") {
      const label = a.kind === "inspection" ? "車検" : "自賠責";
      todos.push({
        key: a.key,
        icon: "vehicle",
        title: `${label}の書類の提出`,
        detail: `${a.vehicle?.plate}：${expiryDetail(`${label}の満了`, days)}`,
        tone: tone(days),
        cta: `更新後の${label}の書類を撮影する`,
        target: { tab: "docs", doc: "vehicle" },
      });
    } else if (a.kind === "oil") {
      todos.push({
        key: a.key,
        icon: "oil",
        title: "オイル交換",
        detail: `前回の交換から ${days.toLocaleString("ja-JP")}km 走りました`,
        tone: days >= THRESHOLDS.oilEscalateKm ? "red" : "amber",
        cta: "交換したら報告する",
        target: { tab: "daily" },
      });
    }
  }

  let mileage: MileageStatus | null = null;
  if (needsMonthlyMileage(driver, vehicles)) {
    mileage = mileageStatus(driver.id, reports);
    if (!mileage.reportedAt) {
      todos.push({
        key: `mileage:${driver.id}`,
        icon: "mileage",
        title: "今月の走行距離の報告",
        detail: mileage.overdue
          ? `締め切り（${md(mileage.dueDate)}）を過ぎています`
          : `${md(mileage.dueDate)}までに報告してください`,
        tone: mileage.overdue ? "red" : "blue",
        cta: "メーターの数字を報告する",
        target: { tab: "daily" },
      });
    }
  }

  const rank = { red: 0, amber: 1, blue: 2 };
  return { todos: todos.sort((a, b) => rank[a.tone] - rank[b.tone]), mileage };
}
