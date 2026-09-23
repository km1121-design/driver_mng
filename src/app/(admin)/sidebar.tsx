"use client";

import { Bell, Car, IdCard, LayoutDashboard, Menu, Truck, Wrench, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/drivers", label: "ドライバー台帳", icon: IdCard },
  { href: "/vehicles", label: "車両・車検管理", icon: Car },
  { href: "/alerts", label: "期限アラート管理", icon: Bell, badge: "alerts" as const },
  { href: "/defects", label: "車両報告 (キズ等)", icon: Wrench, badge: "defects" as const },
];

export function Sidebar({
  alertCount,
  defectCount,
  demo,
}: {
  alertCount: number;
  defectCount: number;
  demo: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const counts = { alerts: alertCount, defects: defectCount };

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const count = badge ? counts[badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Icon className="size-4.5" />
            {label}
            {count > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div>
      <p className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Truck className="size-5 text-blue-400" /> FleetManager
      </p>
      <p className="mt-0.5 text-xs text-slate-400">ドライバー・車両統合管理</p>
    </div>
  );

  return (
    <>
      {/* モバイル: 上部バー */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        {brand}
        <button type="button" onClick={() => setOpen(true)} aria-label="メニュー" className="p-2">
          <Menu className="size-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white shadow-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          {brand}
          <button type="button" onClick={() => setOpen(false)} className="lg:hidden" aria-label="閉じる">
            <X className="size-5 text-slate-400" />
          </button>
        </div>
        {nav}
        {demo && (
          <div className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
            <p className="font-bold">デモモード</p>
            メモリ上のサンプルデータで動作中です。再起動で初期化されます。
            <Link href="/portal?id=demo-sato" target="_blank" className="mt-1 block font-bold text-amber-100 underline">
              ドライバー画面を開く →
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
