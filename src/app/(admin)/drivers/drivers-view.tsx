"use client";

import { Copy, ExternalLink, FileUp, IdCard, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
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

/** ドライバーごとの最新の免許証画像 (表・裏) */
export type LicensePhotos = Record<string, { front?: string; back?: string; date?: string }>;

/** 免許の種類と条件 (AT限定などは車両の割り当てに影響するため目立たせる) */
function LicenseSummary({ d }: { d: Driver }) {
  if (!d.license_class && !d.license_number) return <span className="text-sm text-slate-400">未登録</span>;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-800">{d.license_class || "種類未登録"}</p>
      {d.license_conditions && (
        <div className="flex flex-wrap gap-1">
          {d.license_conditions.split(/[、,]\s*/).filter(Boolean).map((c) => (
            <span
              key={c}
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                c.includes("AT") ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {d.license_number && <p className="font-mono text-[11px] text-slate-400">No. {d.license_number}</p>}
    </div>
  );
}

function LineBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-700">LINE</span>
  ) : (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">LINE未連携</span>
  );
}

export function DriversView({
  drivers,
  vehicles,
  lastReport,
  licensePhotos,
  baseUrl,
  lineLinkBase,
}: {
  drivers: Driver[];
  vehicles: Vehicle[];
  lastReport: Record<string, string>;
  licensePhotos: LicensePhotos;
  baseUrl: string;
  lineLinkBase: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DriverStatus | "all" | "enrolled">("enrolled");
  const [editing, setEditing] = useState<Driver | "new" | null>(null);

  const filtered = useMemo(() => {
    const kw = q.trim().replaceAll(/[\s-]/g, "");
    return drivers.filter((d) => {
      if (status === "enrolled" ? d.status === "retired" : status !== "all" && d.status !== status) return false;
      if (!kw) return true;
      return `${d.name}${d.phone}${d.email}${d.license_number}`.replaceAll(/[\s-]/g, "").includes(kw);
    });
  }, [drivers, q, status]);

  const vehicleOf = (id: string) => vehicles.find((v) => v.current_driver_id === id && v.status !== "retired");

  return (
    <>
      <PageHeader
        title="ドライバー台帳"
        description={`${filtered.length} 名を表示中`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/import?kind=drivers"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileUp className="size-4" /> 一括取り込み
            </Link>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="size-4" /> 新規ドライバー登録
            </button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="氏名、電話番号、メール、免許証番号で検索..."
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
              <th className="p-4 font-medium">免許 (種類・条件)</th>
              <th className="p-4 font-medium">免許有効期限</th>
              <th className="p-4 font-medium">最終報告</th>
              <th className="p-4 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-slate-50">
                <td className="p-4">
                  <p className="flex items-center gap-1.5 font-bold text-slate-800">{d.name} <LineBadge linked={Boolean(d.line_user_id)} /></p>
                  <p className="text-xs text-slate-500">{d.phone || "電話番号未登録"}</p>
                </td>
                <td className="p-4"><DriverTypeBadge type={d.type} /></td>
                <td className="p-4"><DriverStatusBadge status={d.status} /></td>
                <td className="p-4 text-sm">{vehicleOf(d.id)?.plate ?? <span className="text-slate-400">—</span>}</td>
                <td className="p-4"><LicenseSummary d={d} /></td>
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
                  <p className="flex items-center gap-1.5 font-bold">{d.name} <LineBadge linked={Boolean(d.line_user_id)} /></p>
                  <DriverStatusBadge status={d.status} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <DriverTypeBadge type={d.type} /> {d.phone}
                </div>
                <div className="mt-2 flex items-start justify-between gap-3 text-xs">
                  <span className="shrink-0 text-slate-500">免許</span>
                  <div className="text-right [&_div]:justify-end"><LicenseSummary d={d} /></div>
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
        photos={editing && editing !== "new" ? licensePhotos[editing.id] : undefined}
        baseUrl={baseUrl}
        lineLinkBase={lineLinkBase}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function DriverModal({
  driver,
  photos,
  baseUrl,
  lineLinkBase,
  onClose,
}: {
  driver: Driver | "new" | null;
  photos?: LicensePhotos[string];
  baseUrl: string;
  lineLinkBase: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveDriver, null);
  const [regenPending, startRegen] = useTransition();
  const toast = useToast();
  useActionFeedback(state, onClose);
  const d = driver && driver !== "new" ? driver : null;
  const url = d ? `${baseUrl}/portal?id=${d.portal_token}` : "";
  const lineLink = d ? `${lineLinkBase}?link=${d.portal_token}` : "";

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
        <fieldset className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-bold text-blue-800">
            <IdCard className="size-4" /> 運転免許証
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="dm-lic-number">免許証番号</label>
              <input id="dm-lic-number" name="license_number" inputMode="numeric" maxLength={12} defaultValue={d?.license_number} placeholder="12桁" className="field bg-white font-mono" />
            </div>
            <div>
              <label className="field-label" htmlFor="dm-lic-expiry">有効期限</label>
              <input id="dm-lic-expiry" type="date" name="license_expiry" defaultValue={d?.license_expiry} className="field bg-white" />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="dm-lic-class">種類</label>
            <input id="dm-lic-class" name="license_class" list="license-classes" defaultValue={d?.license_class} placeholder="例: 普通・準中型" className="field bg-white" />
            <datalist id="license-classes">
              {["普通", "普通・準中型", "普通・準中型・中型", "普通・準中型・中型・大型"].map((v) => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div>
            <label className="field-label" htmlFor="dm-lic-cond">条件等</label>
            <input id="dm-lic-cond" name="license_conditions" defaultValue={d?.license_conditions} placeholder="例: AT限定、眼鏡等 (なければ空欄)" className="field bg-white" />
          </div>
          {d && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">提出された画像:</span>
              {photos?.front || photos?.back ? (
                <>
                  {photos.front && (
                    <a href={photos.front} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 font-bold text-blue-600">
                      表面 <ExternalLink className="size-3" />
                    </a>
                  )}
                  {photos.back && (
                    <a href={photos.back} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 font-bold text-blue-600">
                      裏面 <ExternalLink className="size-3" />
                    </a>
                  )}
                  {photos.date && <span className="text-slate-400">{formatDateTime(photos.date)} 提出</span>}
                </>
              ) : (
                <span className="text-slate-400">まだ提出されていません</span>
              )}
            </div>
          )}
        </fieldset>
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
          <input name="line_user_id" defaultValue={d?.line_user_id} placeholder="U から始まるID (下の登録用リンクで自動入力)" className="field font-mono text-xs" />
          {d && (
            <div className="mt-2 rounded-lg bg-green-50 p-3">
              <p className="mb-1.5 text-xs text-green-800">
                LINE 登録用リンク: 公式アカウントのチャットでドライバーに送り、LINE 上で開いてもらうと ID が自動で登録されます。
              </p>
              <div className="flex gap-2">
                <input readOnly value={lineLink} className="field bg-white font-mono text-xs" onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  aria-label="LINE 登録用リンクをコピー"
                  onClick={() => navigator.clipboard.writeText(lineLink).then(() => toast("LINE 登録用リンクをコピーしました", "success"))}
                  className="shrink-0 rounded-lg border border-green-200 bg-white px-3 text-green-700 hover:bg-green-100"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
          )}
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
