import { Car, Droplet, IdCard, Road, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Alert } from "@/lib/alerts";
import { ALERT_KIND_LABEL, type AlertKind } from "@/lib/types";

export const KIND_ICON: Record<AlertKind, typeof IdCard> = {
  license: IdCard,
  inspection: Car,
  insurance: ShieldCheck,
  oil: Droplet,
  unreported: Road,
};

export function AlertRow({ alert }: { alert: Alert }) {
  const Icon = KIND_ICON[alert.kind];
  const critical = alert.severity === "critical";
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
        critical ? "border-red-100 bg-red-50" : "border-orange-100 bg-orange-50"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className={`size-5 shrink-0 ${critical ? "text-red-500" : "text-orange-500"}`} />
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">
            {alert.kind === "license" || alert.kind === "unreported"
              ? alert.driver?.name
              : `${alert.vehicle?.plate}${alert.driver ? ` (${alert.driver.name})` : ""}`}
            <span className="ml-2 text-xs font-normal text-slate-500">{ALERT_KIND_LABEL[alert.kind]}</span>
          </p>
          <p className={`text-sm ${critical ? "text-red-600" : "text-orange-700"}`}>{alert.summary}</p>
        </div>
      </div>
      <Link
        href={`/alerts?focus=${encodeURIComponent(alert.key)}`}
        className="rounded border border-slate-200 bg-white px-3 py-1 text-sm font-medium hover:bg-slate-50"
      >
        個別対応へ
      </Link>
    </li>
  );
}

