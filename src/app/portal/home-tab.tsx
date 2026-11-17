"use client";

import { CheckCircle2, ChevronRight, Droplet, FileText, Gauge, IdCard, Wrench } from "lucide-react";
import type { MileageStatus } from "@/lib/alerts";
import { formatDateTime } from "@/lib/date";
import type { DriverTodo, TodoTarget } from "@/lib/todos";

const ICON = { license: IdCard, vehicle: FileText, oil: Droplet, mileage: Gauge };

const TONE = {
  red: { card: "border-red-200 bg-red-50", badge: "bg-red-600 text-white", detail: "text-red-700", button: "bg-red-600" },
  amber: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-500 text-white", detail: "text-amber-800", button: "bg-blue-600" },
  blue: { card: "border-blue-100 bg-white", badge: "bg-blue-600 text-white", detail: "text-slate-600", button: "bg-blue-600" },
};

function nextMonthWindow(dueDate: string) {
  const m = Number(dueDate.slice(5, 7));
  const next = m === 12 ? 1 : m + 1;
  return `${next}月1日〜${next}月${Number(dueDate.slice(8))}日`;
}

/** 開いて最初に出る画面。やることだけを大きく出し、なければ「ありません」と言い切る */
export function HomeTab({
  todos,
  mileage,
  hasVehicle,
  onGo,
}: {
  todos: DriverTodo[];
  mileage: MileageStatus | null;
  hasVehicle: boolean;
  onGo: (target: TodoTarget | { tab: "defect" }) => void;
}) {
  return (
    <div className="space-y-6">
      {todos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700">
            今やること <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{todos.length}</span>
          </h2>
          {todos.map((t) => {
            const Icon = ICON[t.icon];
            const tone = TONE[t.tone];
            return (
              <div key={t.key} className={`rounded-2xl border p-4 shadow-sm ${tone.card}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{t.title}</p>
                    <p className={`mt-0.5 text-sm font-bold ${tone.detail}`}>{t.detail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onGo(t.target)}
                  className={`mt-4 flex w-full items-center justify-center gap-1 rounded-xl py-3.5 text-base font-bold text-white shadow active:scale-[0.98] ${tone.button}`}
                >
                  {t.cta} <ChevronRight className="size-5" />
                </button>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-green-600" />
          <p className="mt-2 text-lg font-bold text-green-800">今やることはありません</p>
          {mileage && (
            <p className="mt-2 text-sm text-green-800">
              次の走行距離の報告は <b>{nextMonthWindow(mileage.dueDate)}</b> です
            </p>
          )}
        </section>
      )}

      {mileage?.reportedAt && (
        <p className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <CheckCircle2 className="size-4 shrink-0 text-green-600" />
          今月の走行距離は報告済みです（{formatDateTime(mileage.reportedAt).slice(5, 10)}）
        </p>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold text-slate-500">そのほかの手続き</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "距離・オイル\n交換の報告", icon: Gauge, target: { tab: "daily" as const }, hidden: !hasVehicle },
            { label: "書類の提出・\n連絡先の変更", icon: FileText, target: { tab: "docs" as const } },
            { label: "キズ・不具合\nの報告", icon: Wrench, target: { tab: "defect" as const }, hidden: !hasVehicle },
          ]
            .filter((x) => !x.hidden)
            .map(({ label, icon: Icon, target }) => (
              <button
                key={label}
                type="button"
                onClick={() => onGo(target)}
                className="card flex flex-col items-center gap-1.5 whitespace-pre-line px-1 py-4 text-center text-[11px] font-bold leading-tight text-slate-700 active:bg-slate-50"
              >
                <Icon className="size-5 text-blue-600" />
                {label}
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
