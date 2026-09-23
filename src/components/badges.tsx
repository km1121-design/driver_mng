import { AlertTriangle } from "lucide-react";
import { THRESHOLDS } from "@/lib/config";
import { daysUntil, formatYmd } from "@/lib/date";
import {
  DRIVER_STATUS_LABEL,
  DRIVER_TYPE_LABEL,
  VEHICLE_STATUS_LABEL,
  type DriverStatus,
  type DriverType,
  type VehicleStatus,
} from "@/lib/types";

export function DriverTypeBadge({ type }: { type: DriverType }) {
  const cls =
    type === "full_commission"
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {DRIVER_TYPE_LABEL[type]}
    </span>
  );
}

export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const cls = {
    active: "text-green-600",
    on_leave: "text-amber-600",
    retired: "text-slate-400",
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${cls}`}>
      <span className="size-2 rounded-full bg-current" />
      {DRIVER_STATUS_LABEL[status]}
    </span>
  );
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const cls = {
    active: "bg-green-50 text-green-700 border-green-200",
    repair: "bg-red-50 text-red-700 border-red-200",
    loaner: "bg-yellow-50 text-yellow-800 border-yellow-200",
    spare: "bg-slate-100 text-slate-600 border-slate-200",
    retired: "bg-slate-50 text-slate-400 border-slate-200",
  }[status];
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-bold ${cls}`}>
      {VEHICLE_STATUS_LABEL[status]}
    </span>
  );
}

/** 期限日を残日数に応じて色分け表示 */
export function ExpiryDate({ ymd }: { ymd: string }) {
  const days = daysUntil(ymd);
  if (days === null) return <span className="text-sm text-slate-400">未登録</span>;
  const tone =
    days < 0 || days <= THRESHOLDS.expiryCriticalDays
      ? "text-red-600 font-bold"
      : days <= THRESHOLDS.expiryWarnDays
        ? "text-orange-600 font-bold"
        : "text-slate-700 font-medium";
  return (
    <span className={`inline-flex flex-col text-sm ${tone}`}>
      <span className="inline-flex items-center gap-1">
        {days <= THRESHOLDS.expiryWarnDays && <AlertTriangle className="size-3.5" />}
        {formatYmd(ymd)}
      </span>
      {days <= THRESHOLDS.expiryWarnDays && (
        <span className="text-[11px] font-medium">
          {days < 0 ? `超過 ${-days}日` : `残り ${days}日`}
        </span>
      )}
    </span>
  );
}
