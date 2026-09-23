"use client";

import { AlertTriangle, FileUp, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import type { ImportKind, ImportPlan } from "@/lib/import";
import { DRIVER_STATUS_LABEL, DRIVER_TYPE_LABEL, USAGE_TYPE_LABEL, VEHICLE_STATUS_LABEL } from "@/lib/types";
import { commitImport, previewImport } from "./actions";

const KINDS: { id: ImportKind; label: string; example: string; hint: string }[] = [
  {
    id: "drivers",
    label: "ドライバー",
    example: "氏名\t区分\t電話番号\tLINEユーザーID\t免許証番号\t免許有効期限\t免許種類\t免許条件\n佐藤 健一\tフルコミ\t090-1234-5678\tU1234…\t301234567890\t2029/5/1\t普通・準中型\t眼鏡等",
    hint: "必須は「氏名」だけです。同じ氏名のドライバーがすでに台帳にあれば、空欄でない項目だけを上書きします。専用 URL は自動で発行されます。",
  },
  {
    id: "vehicles",
    label: "車両",
    example: "ナンバー\t車種\t担当ドライバー\t車検満了日\t自賠責満了日\t走行距離\t前回オイル交換距離\n品川 400 あ 12-34\tハイエース\t佐藤 健一\t令和9年3月31日\t2027/4/30\t45,200\t42,000",
    hint: "必須は「ナンバー」だけです。担当ドライバーは氏名で照合するため、先にドライバーを取り込んでください。",
  },
];

const ACTION_LABEL = {
  insert: { text: "新規", cls: "bg-blue-50 text-blue-700" },
  update: { text: "更新", cls: "bg-green-50 text-green-700" },
  skip: { text: "除外", cls: "bg-red-50 text-red-700" },
};

const FIELD_LABEL: Record<string, string> = {
  name: "氏名", type: "区分", status: "ステータス", phone: "電話", email: "メール",
  emergency_contact_name: "緊急連絡先", emergency_contact_phone: "緊急連絡先電話", line_user_id: "LINE",
  license_expiry: "免許期限", license_number: "免許番号", license_class: "免許種類", license_conditions: "条件",
  plate: "ナンバー", car_type: "車種", usage_type: "利用区分", current_driver_id: "担当", inspection_expiry: "車検",
  insurance_expiry: "自賠責", current_mileage: "走行距離", last_oil_mileage: "オイル交換時",
};

function formatValue(kind: ImportKind, key: string, v: string | number) {
  const labels: Record<string, Record<string, string>> = {
    type: DRIVER_TYPE_LABEL,
    status: kind === "drivers" ? DRIVER_STATUS_LABEL : VEHICLE_STATUS_LABEL,
    usage_type: USAGE_TYPE_LABEL,
  };
  if (labels[key]) return labels[key][String(v)] ?? v;
  if (key === "line_user_id") return `${String(v).slice(0, 6)}…`;
  if (key === "current_driver_id") return "照合済み";
  if (key === "current_mileage" || key === "last_oil_mileage") return `${Number(v).toLocaleString()} km`;
  return v;
}

/** Excel で保存した CSV (Shift_JIS) と UTF-8 の両方を読む */
async function readFileText(file: File) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("shift_jis").decode(buf);
  }
}

export function ImportView({ initialKind }: { initialKind: ImportKind }) {
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const meta = KINDS.find((k) => k.id === kind)!;

  const reset = (next: Partial<{ kind: ImportKind; text: string }>) => {
    if (next.kind) setKind(next.kind);
    if (next.text !== undefined) setText(next.text);
    setPlan(null);
    setError("");
  };

  const preview = () =>
    start(async () => {
      const r = await previewImport(kind, text);
      if (r.ok) {
        setPlan(r.plan);
        setError("");
      } else {
        setPlan(null);
        setError(r.message);
      }
    });

  const commit = () =>
    start(async () => {
      const r = await commitImport(kind, text);
      toast(r.message, r.ok ? "success" : "error");
      if (r.ok) reset({ text: "" });
    });

  const n = (k: "insert" | "update" | "skip") => plan?.rows.filter((r) => r.action === k).length ?? 0;

  return (
    <>
      <PageHeader title="一括取り込み" description="今お使いの台帳 (Excel・スプレッドシート) から、まとめて登録・更新します" />

      <div className="card space-y-5 p-5">
        <div className="flex gap-2" role="tablist">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={kind === k.id}
              onClick={() => reset({ kind: k.id })}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                kind === k.id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Excel やスプレッドシートで、<b>1行目の見出しを含めて</b>表全体を選択してコピー</li>
          <li>下の欄に貼り付け (CSV ファイルを選んでも構いません)</li>
          <li>「内容を確認」で取り込み結果を確かめてから「取り込む」</li>
        </ol>
        <p className="text-xs text-slate-500">{meta.hint}</p>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="import-text" className="field-label !mb-0">貼り付け欄</label>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <FileUp className="size-3.5" /> CSV ファイルを選ぶ
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) reset({ text: await readFileText(file) });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea
            id="import-text"
            value={text}
            onChange={(e) => reset({ text: e.target.value })}
            rows={8}
            placeholder={meta.example}
            className="field font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!text.trim() || pending}
            onClick={preview}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending && !plan ? <Loader2 className="size-4 animate-spin" /> : null} 内容を確認
          </button>
          <Link href={kind === "drivers" ? "/drivers" : "/vehicles"} className="text-sm text-slate-500 hover:underline">
            {kind === "drivers" ? "ドライバー台帳" : "車両・車検管理"}へ戻る
          </Link>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>

      {plan && (
        <div className="card mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">
              新規 {n("insert")} 件・更新 {n("update")} 件
              {n("skip") > 0 && <span className="text-red-600">・除外 {n("skip")} 件</span>}
            </p>
            <button
              type="button"
              disabled={pending || n("insert") + n("update") === 0}
              onClick={commit}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {n("insert") + n("update")} 件を取り込む
            </button>
          </div>
          <div className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
            認識した列:{" "}
            {plan.columns.map((c) => (
              <span key={c.header} className={`mr-2 inline-block ${c.field ? "text-slate-700" : "text-slate-400 line-through"}`}>
                {c.header}
                {c.field && FIELD_LABEL[c.field] && c.header !== FIELD_LABEL[c.field] ? ` → ${FIELD_LABEL[c.field]}` : ""}
              </span>
            ))}
            {plan.columns.some((c) => !c.field) && <span className="text-slate-400">(取り消し線の列は取り込みません)</span>}
          </div>
          <ul className="divide-y divide-slate-100">
            {plan.rows.map((r) => (
              <li key={r.line} className="flex gap-3 p-4 text-sm">
                <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-slate-400">{r.line}行</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-slate-800">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${ACTION_LABEL[r.action].cls}`}>{ACTION_LABEL[r.action].text}</span>
                    {r.label}
                  </p>
                  <p className="break-all text-xs text-slate-500">
                    {Object.entries(r.fields)
                      .filter(([k]) => k !== "name" && k !== "plate")
                      .map(([k, v]) => `${FIELD_LABEL[k] ?? k}: ${formatValue(plan.kind, k, v)}`)
                      .join(" / ") || "—"}
                  </p>
                  {r.errors.map((m) => (
                    <p key={m} className="flex items-start gap-1 text-xs font-bold text-red-600"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{m}</p>
                  ))}
                  {r.warnings.map((m) => (
                    <p key={m} className="flex items-start gap-1 text-xs text-amber-700"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{m}</p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
