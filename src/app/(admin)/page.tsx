import { CheckCircle2, ChevronRight, Clock, MessageCircleOff, Phone, Road, Wrench } from "lucide-react";
import Link from "next/link";
import { KIND_ICON } from "@/components/alert-row";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { mileageStatus, needsMonthlyMileage, type Alert } from "@/lib/alerts";
import { THRESHOLDS, liffUrl } from "@/lib/config";
import { formatDateTime, formatKm } from "@/lib/date";
import { loadAll } from "@/lib/data";
import { ALERT_KIND_LABEL } from "@/lib/types";

export const metadata = { title: "ダッシュボード" };

// 管理者が「今日なにをすればいいか」だけを上に出す。
// 本人の対応待ちのもの (自動通知に任せているもの) は下にまとめ、手を出さなくてよいことを明示する。

type Task = {
  key: string;
  icon: typeof Wrench;
  critical: boolean;
  who: string;
  what: string;
  task: string;
  action: React.ReactNode;
};

const btn =
  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold shadow-sm transition";

function alertWho(a: Alert) {
  if (a.kind === "license" || a.kind === "unreported") return a.driver?.name ?? "—";
  return `${a.vehicle?.plate ?? ""}${a.driver ? `（${a.driver.name}）` : "（担当なし）"}`;
}

function md(iso: string) {
  return formatDateTime(iso).slice(5, 10);
}

export default async function DashboardPage() {
  const { drivers, vehicles, reports, alerts, defects } = await loadAll();
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const plate = new Map(vehicles.map((v) => [v.id, v.plate]));

  // ---- 管理者がやること ----
  const tasks: Task[] = [];
  for (const a of alerts.filter((x) => x.waitingOn === "admin")) {
    tasks.push({
      key: a.key,
      icon: KIND_ICON[a.kind],
      critical: a.severity === "critical",
      who: alertWho(a),
      what: `${ALERT_KIND_LABEL[a.kind]}：${a.summary}`,
      task: a.adminTask ?? "",
      action: a.driver?.phone ? (
        <a href={`tel:${a.driver.phone}`} className={`${btn} bg-slate-800 text-white hover:bg-slate-700`}>
          <Phone className="size-4" /> 電話する
        </a>
      ) : (
        <Link href={`/alerts?focus=${encodeURIComponent(a.key)}`} className={`${btn} border border-slate-200 bg-white hover:bg-slate-50`}>
          詳細を見る
        </Link>
      ),
    });
  }
  for (const d of defects.filter((x) => x.status === "open")) {
    tasks.push({
      key: `defect:${d.id}`,
      icon: Wrench,
      critical: false,
      who: `${plate.get(d.vehicle_id) ?? "—"}（${driverName.get(d.driver_id) ?? "—"}）`,
      what: `キズ・不具合の報告：${d.location}`,
      task: `${md(d.date)} に報告がありました。写真を見て対応を決めてください`,
      action: (
        <Link href="/defects" className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
          確認する
        </Link>
      ),
    });
  }
  const linkBase = liffUrl();
  for (const d of drivers.filter((x) => x.status === "active" && !x.line_user_id)) {
    tasks.push({
      key: `line:${d.id}`,
      icon: MessageCircleOff,
      critical: false,
      who: d.name,
      what: "LINE 未連携",
      task: "期限などのお知らせが届きません。LINE 登録用リンクを公式アカウントのチャットで送ってください",
      action: (
        <CopyButton
          text={`${linkBase}?link=${d.portal_token}`}
          label="登録リンクをコピー"
          done={`${d.name} さんの LINE 登録用リンクをコピーしました`}
          className={`${btn} bg-line text-white hover:bg-line-dark`}
        />
      ),
    });
  }
  tasks.sort((a, b) => Number(b.critical) - Number(a.critical));

  // ---- 本人の対応待ち (自動通知に任せている) ----
  const waiting = alerts.filter((a) => a.waitingOn === "driver");

  // ---- 今月の走行距離 ----
  const targets = drivers.filter((d) => needsMonthlyMileage(d, vehicles));
  const statuses = targets.map((d) => ({ d, st: mileageStatus(d.id, reports) }));
  const reported = statuses.filter((x) => x.st.reportedAt).length;
  const dueDate = statuses[0]?.st.dueDate;
  const pending = statuses.filter((x) => !x.st.reportedAt);
  const pct = targets.length ? Math.round((reported / targets.length) * 100) : 0;

  const recent = [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <>
      <PageHeader title="ダッシュボード" description={`最終更新: ${formatDateTime(new Date().toISOString())}`} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {/* 今日やること */}
          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              今日やること
              <span className={`rounded-full px-2.5 py-0.5 text-sm ${tasks.length ? "bg-red-600 text-white" : "bg-green-100 text-green-700"}`}>
                {tasks.length}件
              </span>
            </h2>
            <p className="mb-4 text-xs text-slate-500">管理者が動く必要があるものだけを出しています。</p>
            {tasks.length === 0 ? (
              <p className="flex flex-col items-center gap-2 py-8 text-center text-sm font-bold text-green-700">
                <CheckCircle2 className="size-10" /> 今日、管理者がやることはありません
              </p>
            ) : (
              <ul className="space-y-3">
                {tasks.map((t) => (
                  <li
                    key={t.key}
                    className={`flex flex-col gap-3 rounded-xl border border-l-4 p-4 sm:flex-row sm:items-center ${
                      t.critical ? "border-red-200 border-l-red-500 bg-red-50" : "border-slate-200 border-l-amber-400 bg-white"
                    }`}
                  >
                    <t.icon className={`hidden size-5 shrink-0 sm:block ${t.critical ? "text-red-500" : "text-slate-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{t.who}</p>
                      <p className={`text-sm font-medium ${t.critical ? "text-red-700" : "text-slate-600"}`}>{t.what}</p>
                      <p className="mt-1 text-sm text-slate-800">→ {t.task}</p>
                    </div>
                    {t.action}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 本人の対応待ち */}
          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <Clock className="size-5 text-slate-400" /> 本人の対応待ち
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm text-slate-600">{waiting.length}件</span>
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              LINE で自動的にお知らせしています。期限の{THRESHOLDS.expiryEscalateDays}日前を過ぎても更新がなければ「今日やること」に移ります。
            </p>
            {waiting.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">ありません</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {waiting.map((a) => {
                  const Icon = KIND_ICON[a.kind];
                  return (
                    <li key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                      <Icon className="size-4 shrink-0 text-slate-400" />
                      <span className="font-medium text-slate-800">{alertWho(a)}</span>
                      <span className="text-slate-500">{ALERT_KIND_LABEL[a.kind]}：{a.summary}</span>
                      <span className="ml-auto text-xs text-slate-400">
                        {a.lastNotice ? `${md(a.lastNotice)} 通知済み` : "通知予定"}
                        {!a.driver?.line_user_id && <span className="ml-2 font-bold text-amber-600">LINE未連携</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {waiting.length > 0 && (
              <Link href="/alerts" className="mt-3 flex items-center justify-end gap-1 text-sm font-bold text-blue-600">
                アラート一覧で手動送信する <ChevronRight className="size-4" />
              </Link>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {/* 今月の走行距離 */}
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Road className="size-5 text-blue-500" /> 今月の走行距離
            </h2>
            {targets.length === 0 ? (
              <p className="text-sm text-slate-400">対象のドライバー（固定車両の担当者）がいません</p>
            ) : (
              <>
                <p className="flex items-baseline justify-between text-sm text-slate-600">
                  <span>
                    <b className="text-2xl text-slate-900">{reported}</b> / {targets.length}名 報告済み
                  </span>
                  {dueDate && <span className="text-xs">締め {Number(dueDate.slice(5, 7))}月{THRESHOLDS.mileageDueDay}日</span>}
                </p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
                {pending.length > 0 && (
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    未報告: {pending.map((x) => x.d.name).join("、")}
                    {!pending[0].st.overdue && "（締め日までは LINE で自動的にお知らせします）"}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="card min-w-0 p-5">
            <h2 className="mb-4 text-lg font-bold">最近の報告</h2>
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
          </section>
        </div>
      </div>
    </>
  );
}
