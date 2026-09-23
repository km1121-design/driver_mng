"use client";

import { Car, User } from "lucide-react";
import { useState } from "react";
import { USAGE_TYPE_LABEL, type Driver, type Vehicle } from "@/lib/types";
import { DailyTab } from "./daily-tab";
import { DefectTab } from "./defect-tab";
import { DocsTab, type DocGroup } from "./docs-tab";

export type PortalDriver = Pick<
  Driver,
  | "name"
  | "type"
  | "phone"
  | "email"
  | "emergency_contact_name"
  | "emergency_contact_phone"
  | "license_expiry"
  | "license_number"
  | "license_class"
  | "license_conditions"
>;
export type PortalVehicle = Pick<
  Vehicle,
  | "plate"
  | "car_type"
  | "usage_type"
  | "current_mileage"
  | "last_oil_mileage"
  | "inspection_expiry"
  | "insurance_expiry"
>;

type Tab = "daily" | "docs" | "defect";

const TABS: { id: Tab; label: string }[] = [
  { id: "daily", label: "距離・状態" },
  { id: "docs", label: "各種提出" },
  { id: "defect", label: "車両報告" },
];

export function PortalApp({
  token,
  driver,
  vehicle,
  lastReportAt,
  initialTab,
  initialDoc,
  adminPhone,
}: {
  token: string;
  driver: PortalDriver;
  vehicle: PortalVehicle | null;
  lastReportAt: string | null;
  initialTab: Tab;
  initialDoc: DocGroup | null;
  adminPhone: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-xl">
      <header className="sticky top-0 z-20 bg-slate-900 px-4 pb-0 pt-4 text-white shadow-md">
        <h1 className="text-center text-sm font-bold">ドライバーポータル</h1>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500">
            <User className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {driver.name} <span className="ml-1 text-xs font-normal text-slate-300">さん</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
              <Car className="size-3" />
              {vehicle ? `${vehicle.plate} (${USAGE_TYPE_LABEL[vehicle.usage_type]})` : "担当車両なし"}
            </p>
          </div>
        </div>
        <nav className="mt-3 flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 border-b-2 py-3 text-xs font-bold transition-colors ${
                tab === t.id ? "border-blue-400 text-white" : "border-transparent text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 p-4 pb-28">
        {tab === "daily" && <DailyTab token={token} vehicle={vehicle} lastReportAt={lastReportAt} />}
        {tab === "docs" && <DocsTab token={token} driver={driver} vehicle={vehicle} initialDoc={initialDoc} />}
        {tab === "defect" && <DefectTab token={token} vehicle={vehicle} adminPhone={adminPhone} />}
      </div>
    </div>
  );
}

/** 画面下部に固定する送信ボタン */
export function StickySubmit({
  children,
  disabled,
  tone = "blue",
  form,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  tone?: "blue" | "dark" | "red";
  form?: string;
}) {
  const cls = { blue: "bg-blue-600", dark: "bg-slate-800", red: "bg-red-600" }[tone];
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md bg-gradient-to-t from-slate-50 via-slate-50 to-transparent p-4 pt-8">
      <button
        form={form}
        disabled={disabled}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50 ${cls}`}
      >
        {children}
      </button>
    </div>
  );
}
