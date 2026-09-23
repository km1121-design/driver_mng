"use client";

import { MessageCircle, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { KIND_ICON } from "@/components/alert-row";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { THRESHOLDS } from "@/lib/config";
import { formatDateTime } from "@/lib/date";
import { ALERT_KIND_LABEL, type AlertKind } from "@/lib/types";
import { sendManualAlert } from "../actions";

type Item = {
  key: string;
  kind: AlertKind;
  severity: "critical" | "warning";
  summary: string;
  driverName: string | null;
  lineLinked: boolean;
  plate: string | null;
  lastManualNotice: string | null;
  message: string;
};

const GROUPS: { title: string; kinds: AlertKind[]; tone: string }[] = [
  { title: `免許・車検・自賠責 (${THRESHOLDS.expiryWarnDays}日以内)`, kinds: ["license", "inspection", "insurance"], tone: "red" },
  { title: `オイル交換推奨 (${THRESHOLDS.oilChangeKm.toLocaleString()}km超過)`, kinds: ["oil"], tone: "orange" },
  { title: `走行距離 未報告 (${THRESHOLDS.unreportedDays}日以上)`, kinds: ["unreported"], tone: "slate" },
];

const TONE = {
  red: "bg-red-50 border-red-200 text-red-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
  slate: "bg-slate-100 border-slate-200 text-slate-700",
} as Record<string, string>;

export function AlertsView({ alerts, focus }: { alerts: Item[]; focus: string | null }) {
  const [selected, setSelected] = useState<string | null>(
    focus && alerts.some((a) => a.key === focus) ? focus : (alerts[0]?.key ?? null),
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  // ダッシュボードの「個別対応へ」(?focus=key) から来た場合はその行までスクロール
  useEffect(() => {
    if (focus) document.getElementById(focus)?.scrollIntoView({ block: "center" });
  }, [focus]);

  const current = alerts.find((a) => a.key === selected) ?? null;

  function send(item: Item) {
    if (!confirm(`${item.driverName} さんへ LINE を手動送信します。よろしいですか？`)) return;
    setPendingKey(item.key);
    startTransition(async () => {
      const r = await sendManualAlert(item.key);
      setPendingKey(null);
      if (r) toast(r.message, r.ok ? "success" : "error");
    });
  }

  return (
    <>
      <PageHeader
        title="期限アラート エスカレーション管理"
        description="基本の通知は毎朝 GAS が LINE 公式アカウントから自動送信します。ここでは反応のないドライバーへの個別対応を行います。"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const items = alerts.filter((a) => g.kinds.includes(a.kind));
            return (
              <section key={g.title} className={`rounded-xl border p-4 shadow-sm ${TONE[g.tone]}`}>
                <h2 className="mb-3 flex items-center justify-between font-bold">
                  {g.title}
                  <span className="text-sm">{items.length}件</span>
                </h2>
                {items.length === 0 && <p className="text-sm opacity-70">該当なし</p>}
                <ul className="space-y-2">
                  {items.map((a) => {
                    const Icon = KIND_ICON[a.kind];
                    return (
                      <li
                        key={a.key}
                        id={a.key}
                        onClick={() => setSelected(a.key)}
                        className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg border border-l-4 bg-white p-3 text-slate-800 shadow-sm transition ${
                          a.severity === "critical" ? "border-l-red-500" : "border-l-orange-400"
                        } ${selected === a.key ? "ring-2 ring-blue-500" : ""}`}
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-bold">
                            <Icon className="size-4 text-slate-400" />
                            {a.driverName ?? "未割当"}
                            {a.plate && <span className="font-normal text-slate-500">/ {a.plate}</span>}
                          </p>
                          <p className={`text-xs font-bold ${a.severity === "critical" ? "text-red-600" : "text-orange-600"}`}>
                            {ALERT_KIND_LABEL[a.kind]}: {a.summary}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {a.lastManualNotice ? `前回手動送信: ${formatDateTime(a.lastManualNotice)}` : "手動送信なし"}
                            {!a.lineLinked && a.driverName && <span className="ml-2 text-amber-600">LINE未連携</span>}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!a.driverName || pendingKey === a.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            send(a);
                          }}
                          className="flex items-center gap-1 rounded bg-line px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-line-dark disabled:opacity-40"
                        >
                          <Send className="size-3" /> {pendingKey === a.key ? "送信中" : "手動送信"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="card flex flex-col overflow-hidden lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)]">
          <div className="flex items-center gap-2 bg-line p-3 text-sm font-bold text-white">
            <MessageCircle className="size-5" /> メッセージプレビュー (LINE Messaging API)
          </div>
          <div className="flex-1 overflow-y-auto bg-[#7494C0] p-6">
            {current ? (
              <div className="relative inline-block max-w-[90%] whitespace-pre-wrap break-all rounded-2xl bg-white p-4 text-sm text-slate-800 shadow-sm">
                {current.message}
                <div className="absolute -left-1.5 top-4 size-3 rotate-45 bg-white" />
              </div>
            ) : (
              <p className="text-center text-sm text-white/80">左の一覧からアラートを選択してください</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
