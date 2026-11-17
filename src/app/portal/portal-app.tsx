"use client";

import { Car, CircleHelp, User } from "lucide-react";
import { useState } from "react";
import { USAGE_TYPE_LABEL, type Driver, type Vehicle } from "@/lib/types";
import { DailyTab } from "./daily-tab";
import { DefectTab } from "./defect-tab";
import { DocsTab, type DocGroup } from "./docs-tab";
import { HomeTab } from "./home-tab";
import type { MileageStatus } from "@/lib/alerts";
import type { DriverTodo } from "@/lib/todos";

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

export type Tab = "home" | "daily" | "docs" | "defect";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "ホーム" },
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
  todos,
  mileage,
}: {
  token: string;
  driver: PortalDriver;
  vehicle: PortalVehicle | null;
  lastReportAt: string | null;
  initialTab: Tab;
  initialDoc: DocGroup | null;
  adminPhone: string;
  todos: DriverTodo[];
  mileage: MileageStatus | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [doc, setDoc] = useState<DocGroup | null>(initialDoc);
  // 送信が終わったらホームへ戻す (サーバー側の再検証で「今やること」も更新される)
  const goHome = () => {
    setDoc(null);
    setTab("home");
    scrollTo(0, 0);
  };
  const open = (t: Tab, d: DocGroup | null = null) => {
    setDoc(d);
    setTab(t);
    scrollTo(0, 0);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 shadow-xl">
      <header className="sticky top-0 z-20 bg-slate-900 px-4 pb-0 pt-4 text-white shadow-md">
        <div className="relative">
          <h1 className="text-center text-sm font-bold">ドライバーポータル</h1>
          <a
            href="/guide"
            className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] font-bold text-slate-300"
          >
            <CircleHelp className="size-3.5" /> 使い方
          </a>
        </div>
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
              onClick={() => open(t.id)}
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
        {tab === "home" && (
          <HomeTab todos={todos} mileage={mileage} hasVehicle={Boolean(vehicle)} onGo={(t) => open(t.tab, "doc" in t ? (t.doc ?? null) : null)} />
        )}
        {tab === "daily" && <DailyTab token={token} vehicle={vehicle} lastReportAt={lastReportAt} onSubmitted={goHome} />}
        {tab === "docs" && (
          <DocsTab key={doc ?? "list"} token={token} driver={driver} vehicle={vehicle} initialDoc={doc} onSubmitted={goHome} />
        )}
        {tab === "defect" && <DefectTab token={token} vehicle={vehicle} adminPhone={adminPhone} onSubmitted={goHome} />}
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
