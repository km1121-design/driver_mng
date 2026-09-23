"use client";

import { Copy, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { useActionState, useMemo, useState, useTransition } from "react";
import { DriverStatusBadge, DriverTypeBadge, ExpiryDate } from "@/components/badges";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { useActionFeedback, useToast } from "@/components/toast";
import { formatDateTime } from "@/lib/date";
import {
  DRIVER_STATUS_LABEL,
  DRIVER_TYPE_LABEL,
  type Driver,
  type DriverStatus,
  type Vehicle,
} from "@/lib/types";
import { regeneratePortalToken, saveDriver } from "../actions";

export function DriversView({
  drivers,
  vehicles,
  lastReport,
  baseUrl,
}: {
  drivers: Driver[];
  vehicles: Vehicle[];
  lastReport: Record<string, string>;
  baseUrl: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DriverStatus | "all" | "enrolled">("enrolled");
  const [editing, setEditing] = useState<Driver | "new" | null>(null);

  const filtered = useMemo(() => {
    const kw = q.trim().replaceAll(/[\s-]/g, "");
    return drivers.filter((d) => {
      if (status === "enrolled" ? d.status === "retired" : status !== "all" && d.status !== status) return false;
      if (!kw) return true;
      return `${d.name}${d.phone}${d.email}`.replaceAll(/[\s-]/g, "").includes(kw);
    });
  }, [drivers, q, status]);

  const vehicleOf = (id: string) => vehicles.find((v) => v.current_driver_id === id && v.status !== "retired");

  return (
    <>
      <PageHeader
        title="ドライバー台帳"
        description={`${filtered.length} 名を表示中`}
        action={
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="size-4" /> 新規ドライバー登録
          </button>
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="氏名、電話番号、メールで検索..."
              className="field bg-white pl-9"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="field bg-white sm:w-48">
            <option value="enrolled">在籍者 (退職済を除く)</option>
            <option value="all">すべてのステータス</option>
            {Object.entries(DRIVER_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* PC: テーブル */}
        <table className="hidden w-full border-collapse text-left md:table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <th className="p-4 font-medium">氏名 / 連絡先</th>
              <th className="p-4 font-medium">区分</th>
              <th className="p-4 font-medium">ステータス</th>
              <th className="p-4 font-medium">担当車両</th>
              <th className="p-4 font-medium">免許有効期限</th>
              <th className="p-4 font-medium">最終報告</th>
              <th className="p-4 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-slate-50">
                <td className="p-4">
                  <p className="font-bold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.phone || "電話番号未登録"}</p>
                </td>
                <td className="p-4"><DriverTypeBadge type={d.type} /></td>
                <td className="p-4"><DriverStatusBadge status={d.status} /></td>
                <td className="p-4 text-sm">{vehicleOf(d.id)?.plate ?? <span className="text-slate-400">—</span>}</td>
                <td className="p-4"><ExpiryDate ymd={d.license_expiry} /></td>
                <td className="p-4 text-xs text-slate-500">{lastReport[d.id] ? formatDateTime(lastReport[d.id]) : "—"}</td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(d)}
                    aria-label={`${d.name}を編集`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Pencil className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* スマホ: カード */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {filtered.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => setEditing(d)} className="w-full p-4 text-left active:bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{d.name}</p>
                  <DriverStatusBadge status={d.status} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <DriverTypeBadge type={d.type} /> {d.phone}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">免許期限</span>
                  <ExpiryDate ymd={d.license_expiry} />
                </div>
              </button>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && <p className="p-10 text-center text-sm text-slate-400">該当するドライバーがいません</p>}
      </div>

      <DriverModal
        key={editing === "new" ? "new" : (editing?.id ?? "none")}
        driver={editing}
        baseUrl={baseUrl}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function DriverModal({
  driver,
  baseUrl,
  onClose,
}: {
  driver: Driver | "new" | null;
  baseUrl: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveDriver, null);
  const [regenPending, startRegen] = useTransition();
  const toast = useToast();
  useActionFeedback(state, onClose);
  const d = driver && driver !== "new" ? driver : null;
  const url = d ? `${baseUrl}/portal?id=${d.portal_token}` : "";

  return (
    <Modal
      open={driver !== null}
      onClose={onClose}
      title={d ? "ドライバー情報編集" : "新規ドライバー登録"}
      footer={
        <button
          form="driver-form"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
      }
    >
      <form id="driver-form" action={action} className="space-y-4">
        <input type="hidden" name="id" value={d?.id ?? ""} />
        <div>
          <label className="field-label">氏名 *</label>
          <input name="name" required defaultValue={d?.name} className="field font-bold" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">契約区分</label>
            <select name="type" defaultValue={d?.type ?? "full_commission"} className="field font-bold">
              {Object.entries(DRIVER_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">ステータス</label>
            <select name="status" defaultValue={d?.status ?? "active"} className="field font-bold">
              {Object.entries(DRIVER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">免許証の有効期限</label>
          <input type="date" name="license_expiry" defaultValue={d?.license_expiry} className="field" />
        </div>
        <div>
          <label className="field-label">本人の連絡先</label>
          <input type="tel" name="phone" defaultValue={d?.phone} placeholder="電話番号" className="field mb-2" />
          <input type="email" name="email" defaultValue={d?.email} placeholder="メールアドレス" className="field" />
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <label className="field-label !text-red-700">緊急連絡先</label>
          <input name="emergency_contact_name" defaultValue={d?.emergency_contact_name} placeholder="氏名 (続柄)" className="field mb-2 bg-white" />
          <input type="tel" name="emergency_contact_phone" defaultValue={d?.emergency_contact_phone} placeholder="電話番号" className="field bg-white" />
        </div>
        <div>
          <label className="field-label">LINE ユーザーID</label>
          <input name="line_user_id" defaultValue={d?.line_user_id} placeholder="U から始まるID (公式アカウントの友だち追加時に取得)" className="field font-mono text-xs" />
        </div>

        {d && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="field-label">ドライバー専用ポータルURL</p>
            <div className="flex gap-2">
              <input readOnly value={url} className="field font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                aria-label="URLをコピー"
                onClick={() => navigator.clipboard.writeText(url).then(() => toast("URLをコピーしました", "success"))}
                className="shrink-0 rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-slate-50"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <button
              type="button"
              disabled={regenPending}
              onClick={() => {
                if (!confirm("URLを再発行すると、現在のURLは使えなくなります。よろしいですか？")) return;
                startRegen(async () => {
                  const r = await regeneratePortalToken(d.id);
                  if (r) toast(r.message, r.ok ? "success" : "error");
                  if (r?.ok) onClose();
                });
              }}
              className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-red-600"
            >
              <RefreshCw className="size-3" /> URLを再発行 (紛失・漏えい時)
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
