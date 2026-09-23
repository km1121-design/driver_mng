import {
  AlertTriangle,
  CalendarClock,
  Car,
  ChevronRight,
  Droplet,
  Road,
  Users,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AlertRow } from "@/components/alert-row";
import { formatDateTime, formatKm } from "@/lib/date";
import { loadAll } from "@/lib/data";
import type { AlertKind } from "@/lib/types";

export const metadata = { title: "ダッシュボード" };

function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  tone,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  unit: string;
  tone: "blue" | "green" | "red" | "orange" | "slate";
  href?: string;
}) {
  const tones = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    orange: "bg-orange-100 text-orange-600",
    slate: "bg-slate-100 text-slate-600",
  };
  const highlight = (tone === "red" || tone === "orange") && value > 0;
  const body = (
    <div
      className={`card flex h-full items-center gap-3 p-4 transition sm:gap-4 sm:p-5 ${href ? "hover:shadow-md" : ""} ${
        highlight ? (tone === "red" ? "border-red-200" : "border-orange-200") : ""
      }`}
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full sm:size-12 ${tones[tone]}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
        <p className={`text-2xl font-bold ${highlight ? (tone === "red" ? "text-red-600" : "text-orange-600") : ""}`}>
          {value}
          <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
        </p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const { drivers, vehicles, reports, alerts, defects } = await loadAll();
  const activeDrivers = drivers.filter((d) => d.status === "active").length;
  const enrolled = drivers.filter((d) => d.status !== "retired").length;
  const activeVehicles = vehicles.filter((v) => v.status === "active" || v.status === "loaner").length;
  const count = (...kinds: AlertKind[]) => alerts.filter((a) => kinds.includes(a.kind)).length;
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const plate = new Map(vehicles.map((v) => [v.id, v.plate]));
  const recent = [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const openDefects = defects.filter((d) => d.status === "open").length;

  return (
    <>
      <PageHeader title="ダッシュボード" description={`最終更新: ${formatDateTime(new Date().toISOString())}`} />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Kpi icon={Users} label="稼働ドライバー" value={activeDrivers} unit={`/ ${enrolled}名`} tone="blue" href="/drivers" />
        <Kpi icon={Car} label="稼働車両" value={activeVehicles} unit="台" tone="green" href="/vehicles" />
        <Kpi icon={CalendarClock} label="期限アラート (45日以内)" value={count("license", "inspection", "insurance")} unit="件" tone="red" href="/alerts" />
        <Kpi icon={Droplet} label="オイル交換推奨" value={count("oil")} unit="台" tone="orange" href="/alerts" />
        <Kpi icon={Road} label="走行距離 未報告" value={count("unreported")} unit="名" tone="slate" href="/alerts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card min-w-0 p-5 xl:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <AlertTriangle className="size-5 text-red-500" /> 対応が必要なタスク
          </h2>
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">対応が必要な項目はありません 🎉</p>
          ) : (
            <ul className="space-y-3">
              {alerts.slice(0, 8).map((a) => (
                <AlertRow key={a.key} alert={a} />
              ))}
            </ul>
          )}
          {alerts.length > 8 && (
            <Link href="/alerts" className="mt-4 flex items-center justify-end gap-1 text-sm font-bold text-blue-600">
              すべて表示 ({alerts.length}件) <ChevronRight className="size-4" />
            </Link>
          )}
        </section>

        <section className="card min-w-0 p-5">
          <h2 className="mb-4 text-lg font-bold">最近の定期報告</h2>
          <ul className="divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{driverName.get(r.driver_id) ?? "—"}</span>
                  <span className="text-xs text-slate-400">{formatDateTime(r.date)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{plate.get(r.vehicle_id) ?? "—"}</span>
                  <span>
                    {formatKm(r.mileage)}
                    {r.is_oil_changed && <span className="ml-1 text-blue-600">オイル交換</span>}
                    {(!r.tire_ok || !r.lights_brakes_ok) && <span className="ml-1 font-bold text-red-600">要点検</span>}
                  </span>
                </div>
              </li>
            ))}
            {recent.length === 0 && <li className="py-6 text-center text-sm text-slate-400">報告はまだありません</li>}
          </ul>
          {openDefects > 0 && (
            <Link href="/defects" className="mt-4 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
              未対応のキズ・不具合報告 {openDefects}件 <ChevronRight className="size-4" />
            </Link>
          )}
        </section>
      </div>
    </>
  );
}
