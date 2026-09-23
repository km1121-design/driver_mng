"use client";

import { Droplet, ExternalLink, FileUp, Pencil, Plus, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { ExpiryDate, VehicleStatusBadge } from "@/components/badges";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { useActionFeedback, useToast } from "@/components/toast";
import { THRESHOLDS } from "@/lib/config";
import { formatDateTime, formatKm, formatYmd } from "@/lib/date";
import { compressImage } from "@/lib/image";
import {
  DOC_TYPE_LABEL,
  USAGE_TYPE_LABEL,
  VEHICLE_STATUS_LABEL,
  type Document,
  type Driver,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/types";
import { adminOcr, adminUploadVehicleDoc, saveVehicle } from "../actions";

export function VehiclesView({
  drivers,
  vehicles,
  documents,
}: {
  drivers: Driver[];
  vehicles: Vehicle[];
  documents: Document[];
}) {
  const [status, setStatus] = useState<VehicleStatus | "all" | "in_use">("in_use");
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name;

  const filtered = useMemo(
    () =>
      vehicles.filter((v) =>
        status === "in_use" ? v.status !== "retired" : status === "all" || v.status === status,
      ),
    [vehicles, status],
  );

  return (
    <>
      <PageHeader
        title="車両・車検管理"
        description={`${filtered.length} 台を表示中`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/import?kind=vehicles"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileUp className="size-4" /> 一括取り込み
            </Link>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="size-4" /> 新規車両登録
            </button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="field bg-white sm:w-56">
            <option value="in_use">保有車両 (廃車済を除く)</option>
            <option value="all">すべてのステータス</option>
            {Object.entries(VEHICLE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <th className="p-4 font-medium">ナンバー / 車種</th>
                <th className="p-4 font-medium">区分・使用者</th>
                <th className="p-4 font-medium">ステータス</th>
                <th className="p-4 font-medium">車検満了日</th>
                <th className="p-4 font-medium">自賠責満了日</th>
                <th className="p-4 font-medium">走行距離</th>
                <th className="p-4 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => {
                const sinceOil = v.current_mileage - v.last_oil_mileage;
                return (
                  <tr key={v.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{v.plate}</p>
                      <p className="text-xs text-slate-500">{v.car_type}</p>
                    </td>
                    <td className="p-4">
                      <p className={`text-sm font-bold ${v.usage_type === "fixed" ? "text-indigo-700" : "text-emerald-700"}`}>
                        {USAGE_TYPE_LABEL[v.usage_type]}
                        <span className="font-normal">{v.usage_type === "fixed" ? " (フルコミ)" : " (アルバイト)"}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {v.current_driver_id ? `使用者: ${driverName(v.current_driver_id) ?? "不明"}` : "未割当"}
                      </p>
                    </td>
                    <td className="p-4"><VehicleStatusBadge status={v.status} /></td>
                    <td className="p-4"><ExpiryDate ymd={v.inspection_expiry} /></td>
                    <td className="p-4"><ExpiryDate ymd={v.insurance_expiry} /></td>
                    <td className="p-4 text-sm">
                      <p className="font-medium">{formatKm(v.current_mileage)}</p>
                      <p className={`flex items-center gap-1 text-[11px] ${sinceOil >= THRESHOLDS.oilChangeKm ? "font-bold text-orange-600" : "text-slate-400"}`}>
                        <Droplet className="size-3" /> 交換後 {sinceOil.toLocaleString("ja-JP")}km
                      </p>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(v)}
                        aria-label={`${v.plate}を編集`}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="p-10 text-center text-sm text-slate-400">該当する車両がありません</p>}
      </div>

      <VehicleModal
        key={editing === "new" ? "new" : (editing?.id ?? "none")}
        vehicle={editing}
        drivers={drivers}
        documents={documents}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function VehicleModal({
  vehicle,
  drivers,
  documents,
  onClose,
}: {
  vehicle: Vehicle | "new" | null;
  drivers: Driver[];
  documents: Document[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveVehicle, null);
  useActionFeedback(state, onClose);
  const v = vehicle && vehicle !== "new" ? vehicle : null;
  const docs = v
    ? documents.filter((d) => d.vehicle_id === v.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    : [];

  return (
    <Modal
      open={vehicle !== null}
      onClose={onClose}
      size="lg"
      title={v ? `車両情報 — ${v.plate}` : "新規車両登録"}
      footer={
        <button
          form="vehicle-form"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : v ? "更新する" : "登録する"}
        </button>
      }
    >
      <form id="vehicle-form" action={action} className="space-y-4">
        <input type="hidden" name="id" value={v?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">ナンバー *</label>
            <input name="plate" required defaultValue={v?.plate} placeholder="品川 500 あ 12-34" className="field font-bold" />
          </div>
          <div>
            <label className="field-label">車種</label>
            <input name="car_type" defaultValue={v?.car_type} placeholder="エブリイ" className="field" />
          </div>
          <div>
            <label className="field-label">区分</label>
            <select name="usage_type" defaultValue={v?.usage_type ?? "fixed"} className="field font-bold">
              <option value="fixed">固定 (フルコミ・リース)</option>
              <option value="shared">共有車 (アルバイト)</option>
            </select>
          </div>
          <div>
            <label className="field-label">現在の使用者 (一時変更可)</label>
            <select name="current_driver_id" defaultValue={v?.current_driver_id ?? ""} className="field font-bold">
              <option value="">未割当 (待機)</option>
              {drivers.filter((d) => d.status !== "retired").map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">車両ステータス</label>
          <select
            name="status"
            defaultValue={v?.status ?? "active"}
            className="w-full rounded-lg border-2 border-blue-200 bg-blue-50 p-3 text-base font-bold text-slate-800 outline-none transition focus:border-blue-400"
          >
            {Object.entries(VEHICLE_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">車検満了日</label>
            <input type="date" name="inspection_expiry" defaultValue={v?.inspection_expiry} className="field" />
          </div>
          <div>
            <label className="field-label">自賠責満了日</label>
            <input type="date" name="insurance_expiry" defaultValue={v?.insurance_expiry} className="field" />
          </div>
          <div>
            <label className="field-label">現在の走行距離 (km)</label>
            <input type="number" min={0} name="current_mileage" defaultValue={v?.current_mileage ?? 0} className="field" />
          </div>
          <div>
            <label className="field-label">前回オイル交換時の距離 (km)</label>
            <input type="number" min={0} name="last_oil_mileage" defaultValue={v?.last_oil_mileage ?? 0} className="field" />
          </div>
        </div>
      </form>

      {v && (
        <>
          <AdminDocUpload vehicle={v} />
          {docs.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-slate-800">提出書類の履歴</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="font-medium">{DOC_TYPE_LABEL[d.doc_type]}</span>
                    <span className="text-slate-500">
                      {formatDateTime(d.date)} / {d.uploaded_by === "admin" ? "管理者" : "ドライバー"}
                      {d.parsed_expiry_date && ` / 満了 ${formatYmd(d.parsed_expiry_date)}`}
                    </span>
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600" aria-label="ファイルを開く">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

const ADMIN_DOCS = [
  { type: "inspection_cert", label: "車検証原本" },
  { type: "inspection_record", label: "記録事項" },
  { type: "insurance_cert", label: "自賠責" },
] as const;

/** 管理者による車検証・記録事項・自賠責の事後アップロード (OCR で満了日を自動入力) */
function AdminDocUpload({ vehicle }: { vehicle: Vehicle }) {
  const [docType, setDocType] = useState<(typeof ADMIN_DOCS)[number]["type"]>("inspection_record");
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [state, action, pending] = useActionState(adminUploadVehicleDoc, null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  useActionFeedback(state, () => {
    setFile(null);
    setExpiry("");
  });

  async function onPick(f: File | undefined) {
    if (!f) return;
    const compressed = await compressImage(f);
    setFile(compressed);
    if (docType === "inspection_cert") return; // 電子車検証には満了日が印字されない
    setOcrBusy(true);
    const fd = new FormData();
    fd.set("doc_type", docType);
    fd.set("file", compressed);
    const r = await adminOcr(fd);
    setOcrBusy(false);
    if ("error" in r) return toast(r.error, "error");
    if (r.expiry_date) {
      setExpiry(r.expiry_date);
      toast(`AI読取: 満了日 ${formatYmd(r.expiry_date)}${r.demo ? " (デモ値)" : ""}`, "success");
    } else toast(r.warning || "満了日を読み取れませんでした。手入力してください", "error");
  }

  return (
    <form
      action={(fd) => {
        if (file) fd.set("file", file);
        action(fd);
      }}
      className="mt-5 border-t border-slate-100 pt-5"
    >
      <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-800">
        <Upload className="size-4 text-blue-500" /> 管理者用: 書類の手動アップロード
      </p>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        ドライバーがスマホから提出しなかった場合、手元の PDF・画像をアップロードして満了日を更新できます。
      </p>
      <input type="hidden" name="vehicle_id" value={vehicle.id} />
      <input type="hidden" name="doc_type" value={docType} />
      <div className="mb-3 grid grid-cols-3 gap-2">
        {ADMIN_DOCS.map((d) => (
          <button
            key={d.type}
            type="button"
            onClick={() => {
              setDocType(d.type);
              setFile(null);
              setExpiry("");
            }}
            className={`rounded-lg border py-2 text-xs font-bold transition ${
              docType === d.type ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-4 text-slate-500 transition hover:bg-slate-100"
      >
        <Upload className="mb-1 size-5" />
        <span className="text-xs font-bold">{file ? file.name : "ファイルを選択"}</span>
      </button>
      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="field-label flex items-center gap-1">
            {docType === "insurance_cert" ? "自賠責満了日" : "車検満了日"}
            {ocrBusy && <span className="flex items-center gap-1 text-blue-600"><Sparkles className="size-3 animate-pulse" /> AI読取中...</span>}
          </label>
          <input type="date" name="expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="field" />
        </div>
        <button
          disabled={!file || pending || ocrBusy}
          className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "送信中..." : "アップロード"}
        </button>
      </div>
      {docType === "inspection_cert" && (
        <p className="mt-2 text-[11px] text-slate-400">※電子車検証には満了日が印字されないため、満了日は「記録事項」から読み取ります。</p>
      )}
    </form>
  );
}
