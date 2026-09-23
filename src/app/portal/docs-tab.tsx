"use client";

import { ArrowLeft, Bot, ChevronRight, CloudUpload, Contact, FileText, IdCard, Info } from "lucide-react";
import { useActionState, useState } from "react";
import { ExpiryDate } from "@/components/badges";
import { useActionFeedback, useToast } from "@/components/toast";
import type { DocType } from "@/lib/types";
import { submitDocuments, updateContact } from "./actions";
import { PhotoPicker } from "./photo-picker";
import { StickySubmit, type PortalDriver, type PortalVehicle } from "./portal-app";

export type DocGroup = "license" | "vehicle" | "contact";

const SAMPLES: Record<string, string> = {
  license: "光が反射しないよう、明るい場所で免許証全体が写るように撮影してください。裏面は記載がなくても必ず撮影してください。",
  inspection_cert: "A6サイズの電子車検証 (ICタグ付き) です。電子車検証には満了日が印字されていないため、②の記録事項も必ず提出してください。",
  inspection_record: "電子車検証と同時に発行される A4 の紙です。「有効期間の満了する日」が記載されています。",
  insurance_cert: "保険会社が発行した証明書です。保険期間 (始期〜終期) 全体が写るようにしてください。",
};

export function DocsTab({
  token,
  driver,
  vehicle,
  initialDoc,
}: {
  token: string;
  driver: PortalDriver;
  vehicle: PortalVehicle | null;
  initialDoc: DocGroup | null;
}) {
  const [group, setGroup] = useState<DocGroup | null>(initialDoc);
  const back = () => setGroup(null);

  if (!group) {
    const items = [
      { id: "license" as const, icon: IdCard, color: "bg-blue-50 text-blue-600", title: "運転免許証", sub: "更新時の提出 (AI自動読取)", expiry: driver.license_expiry },
      { id: "vehicle" as const, icon: FileText, color: "bg-green-50 text-green-600", title: "車検・自賠責関連書類", sub: "車検証・記録事項・自賠責", expiry: vehicle?.inspection_expiry, hidden: !vehicle },
      { id: "contact" as const, icon: Contact, color: "bg-slate-100 text-slate-600", title: "本人の連絡先・緊急連絡先", sub: "入社時や変更時の登録" },
    ];
    return (
      <div className="space-y-3">
        {items.filter((i) => !i.hidden).map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setGroup(i.id)}
            className="card flex w-full items-center justify-between p-4 text-left active:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-full ${i.color}`}>
                <i.icon className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold">{i.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{i.sub}</p>
                {i.expiry !== undefined && (
                  <div className="mt-1 text-[11px]"><ExpiryDate ymd={i.expiry} /></div>
                )}
              </div>
            </div>
            <ChevronRight className="size-4 text-slate-300" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={back} className="mb-4 flex items-center gap-1 py-1 text-sm font-bold text-slate-500">
        <ArrowLeft className="size-4" /> 戻る
      </button>
      {group === "license" && <LicenseForm token={token} onDone={back} />}
      {group === "vehicle" && <VehicleDocsForm token={token} onDone={back} />}
      {group === "contact" && <ContactForm token={token} driver={driver} onDone={back} />}
    </div>
  );
}

function SampleButton({ k }: { k: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-600"
      >
        <Info className="size-3" /> 見本・注意
      </button>
      {open && (
        <p className="col-span-full mt-2 w-full rounded-lg bg-blue-50 p-3 text-left text-xs leading-relaxed text-blue-900">{SAMPLES[k]}</p>
      )}
    </>
  );
}

type Ocr = { status: "idle" | "busy" | "done" | "error"; warning?: string; details?: Record<string, string> };

/** 写真撮影 → /api/ocr で期限を読み取り、確認用の日付欄に反映する */
function useOcr(token: string) {
  const [ocr, setOcr] = useState<Record<string, Ocr>>({});
  const toast = useToast();
  async function run(docType: DocType, file: File, onExpiry: (d: string) => void) {
    setOcr((o) => ({ ...o, [docType]: { status: "busy" } }));
    const fd = new FormData();
    fd.set("token", token);
    fd.set("doc_type", docType);
    fd.set("file", file);
    try {
      const res = await fetch("/api/ocr", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "読み取りに失敗しました");
      if (json.expiry_date) onExpiry(json.expiry_date);
      setOcr((o) => ({ ...o, [docType]: { status: "done", warning: json.warning, details: json.details } }));
      if (json.expiry_date) toast("AIの読み取りが完了しました。日付をご確認ください", "success");
    } catch (e) {
      setOcr((o) => ({ ...o, [docType]: { status: "error", warning: e instanceof Error ? e.message : "" } }));
    }
  }
  return { ocr, run };
}

function OcrStatus({ state }: { state?: Ocr }) {
  if (!state || state.status === "idle") return null;
  if (state.status === "busy") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-blue-700">
        <Bot className="size-4 animate-pulse" /> AIが書類を解析中...
      </p>
    );
  }
  return (
    <div className={`mt-3 rounded-lg border p-3 text-left text-xs ${state.warning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-800"}`}>
      <p className="mb-1 flex items-center gap-1.5 font-bold"><Bot className="size-4" /> AI自動読取結果</p>
      {state.warning && <p>{state.warning} — 日付を手入力してください。</p>}
      {state.details && Object.values(state.details).some(Boolean) && (
        <p className="text-slate-600">{Object.values(state.details).filter(Boolean).join(" / ")}</p>
      )}
    </div>
  );
}

function ExpiryInput({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-3 text-left">
      <label className="field-label">{label} (読取結果を確認・修正してください)</label>
      <input type="date" name={name} value={value} onChange={(e) => onChange(e.target.value)} className="field text-base font-bold" />
    </div>
  );
}

function LicenseForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(submitDocuments, null);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [expiry, setExpiry] = useState("");
  const { ocr, run } = useOcr(token);
  useActionFeedback(state, onDone);

  return (
    <form
      id="license-form"
      action={(fd) => {
        if (front) fd.set("license_front", front);
        if (back) fd.set("license_back", back);
        action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="group" value="license" />
      <div className="flex flex-wrap items-center justify-between">
        <span className="text-sm font-bold text-slate-700">運転免許証の提出</span>
        <SampleButton k="license" />
      </div>
      <section className="card p-5 text-center">
        <p className="mb-3 text-sm font-bold text-slate-700">① 表面を撮影</p>
        <PhotoPicker
          label="写真を撮る"
          file={front}
          onChange={(f) => {
            setFront(f);
            if (f) run("license_front", f, setExpiry);
          }}
        />
        <OcrStatus state={ocr.license_front} />
        {front && <ExpiryInput name="expiry_license" label="有効期限" value={expiry} onChange={setExpiry} />}
      </section>
      <section className="card p-5 text-center">
        <p className="mb-3 text-sm font-bold text-slate-700">
          ② 裏面を撮影 <span className="ml-1 text-[10px] text-red-500">記載なしでも必須</span>
        </p>
        <PhotoPicker label="写真を撮る" file={back} onChange={setBack} />
      </section>
      <StickySubmit form="license-form" tone="dark" disabled={pending || !front || !back || !expiry || ocr.license_front?.status === "busy"}>
        <CloudUpload className="size-4" /> {pending ? "送信中..." : "この内容で送信する"}
      </StickySubmit>
    </form>
  );
}

const VEHICLE_DOCS = [
  { type: "inspection_cert" as const, title: "① 車検証 (原本)", cta: "車検証を撮影" },
  { type: "inspection_record" as const, title: "② 検査証記録事項", cta: "A4用紙を撮影", expiry: { name: "expiry_inspection", label: "車検満了日" } },
  { type: "insurance_cert" as const, title: "③ 自賠責保険証明書", cta: "保険証を撮影", expiry: { name: "expiry_insurance", label: "自賠責の満了日" } },
];

function VehicleDocsForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(submitDocuments, null);
  const [files, setFiles] = useState<Partial<Record<DocType, File | null>>>({});
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const { ocr, run } = useOcr(token);
  useActionFeedback(state, onDone);
  const busy = Object.values(ocr).some((o) => o.status === "busy");

  return (
    <form
      id="vehicle-docs-form"
      action={(fd) => {
        for (const [k, f] of Object.entries(files)) if (f) fd.set(k, f);
        action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="group" value="vehicle" />
      <p className="text-sm font-bold text-slate-700">車検・保険関連書類</p>
      <p className="text-[11px] text-slate-500">更新があった書類だけ撮影して送信できます。</p>
      {VEHICLE_DOCS.map((d) => (
        <section key={d.type} className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between">
            <p className="text-sm font-bold">{d.title}</p>
            <SampleButton k={d.type} />
          </div>
          <PhotoPicker
            label={d.cta}
            compact
            file={files[d.type] ?? null}
            onChange={(f) => {
              setFiles((s) => ({ ...s, [d.type]: f }));
              if (f && d.expiry) run(d.type, f, (v) => setExpiry((e) => ({ ...e, [d.expiry!.name]: v })));
            }}
          />
          {d.expiry && <OcrStatus state={ocr[d.type]} />}
          {d.expiry && files[d.type] && (
            <ExpiryInput
              name={d.expiry.name}
              label={d.expiry.label}
              value={expiry[d.expiry.name] ?? ""}
              onChange={(v) => setExpiry((e) => ({ ...e, [d.expiry!.name]: v }))}
            />
          )}
        </section>
      ))}
      <StickySubmit form="vehicle-docs-form" tone="dark" disabled={pending || busy || !Object.values(files).some(Boolean)}>
        <CloudUpload className="size-4" /> {pending ? "送信中..." : "この内容で送信する"}
      </StickySubmit>
    </form>
  );
}

function ContactForm({ token, driver, onDone }: { token: string; driver: PortalDriver; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateContact, null);
  useActionFeedback(state, onDone);
  return (
    <form id="contact-form" action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <section className="card space-y-4 p-5">
        <h3 className="border-b border-slate-100 pb-2 text-sm font-bold">本人の連絡先</h3>
        <div>
          <label className="field-label">携帯電話番号 *</label>
          <input type="tel" name="phone" required defaultValue={driver.phone} className="field text-base" />
        </div>
        <div>
          <label className="field-label">メールアドレス</label>
          <input type="email" name="email" defaultValue={driver.email} placeholder="example@mail.com" className="field text-base" />
        </div>
      </section>
      <section className="card space-y-4 p-5">
        <h3 className="border-b border-red-100 pb-2 text-sm font-bold text-red-600">緊急連絡先</h3>
        <div>
          <label className="field-label">氏名 (続柄)</label>
          <input name="emergency_contact_name" defaultValue={driver.emergency_contact_name} placeholder="例: 佐藤 花子 (妻)" className="field text-base" />
        </div>
        <div>
          <label className="field-label">電話番号</label>
          <input type="tel" name="emergency_contact_phone" defaultValue={driver.emergency_contact_phone} placeholder="090-0000-0000" className="field text-base" />
        </div>
      </section>
      <StickySubmit form="contact-form" tone="dark" disabled={pending}>
        <CloudUpload className="size-4" /> {pending ? "送信中..." : "この内容で登録する"}
      </StickySubmit>
    </form>
  );
}
