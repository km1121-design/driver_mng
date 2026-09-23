"use client";

import { AlertTriangle, Phone, Plus, Send, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useActionFeedback } from "@/components/toast";
import { compressImage } from "@/lib/image";
import { submitDefect } from "./actions";
import { StickySubmit, type PortalVehicle } from "./portal-app";

const MAX_PHOTOS = 5;

export function DefectTab(props: { token: string; vehicle: PortalVehicle | null; adminPhone: string }) {
  const [formKey, setFormKey] = useState(0);
  return <DefectForm key={formKey} {...props} onDone={() => setFormKey((k) => k + 1)} />;
}

function DefectForm({
  token,
  adminPhone,
  onDone,
}: {
  token: string;
  vehicle: PortalVehicle | null;
  adminPhone: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(submitDefect, null);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useActionFeedback(state, onDone);

  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  });
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  return (
    <form
      id="defect-form"
      action={(fd) => {
        photos.forEach((p) => fd.append("photos", p.file));
        action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 shadow-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p className="leading-relaxed">事故・故障など緊急時は、ここに入力せず直ちに管理者へ直接電話してください。</p>
        </div>
        {adminPhone && (
          <a href={`tel:${adminPhone}`} className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm text-white">
            <Phone className="size-4" /> 管理者に電話する
          </a>
        )}
      </div>

      <section className="card p-5">
        <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold">非緊急のキズ・損傷報告</h3>
        <label className="field-label">損傷・不具合の箇所 *</label>
        <input name="location" required placeholder="例: 左後方バンパーの擦り傷" className="field mb-4 text-base" />

        <label className="field-label">写真 (最大{MAX_PHOTOS}枚)</label>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            const compressed = await Promise.all(picked.map((f) => compressImage(f)));
            const items = compressed.map((file) => ({ file, url: URL.createObjectURL(file) }));
            setPhotos((p) => [...p, ...items].slice(0, MAX_PHOTOS));
          }}
        />
        <div className="hide-scroll mb-4 flex gap-2 overflow-x-auto py-1">
          {photos.map(({ url: u }, i) => (
            <div key={u} className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`写真${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label="削除"
                onClick={() => {
                  URL.revokeObjectURL(u);
                  setPhotos((p) => p.filter((_, j) => j !== i));
                }}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className="flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400"
              aria-label="写真を追加"
            >
              <Plus className="size-6" />
            </button>
          )}
        </div>

        <label className="field-label">詳細・メモ</label>
        <textarea name="note" placeholder="乗車前からついていたキズです 等" className="field h-24 resize-none text-base" />
      </section>

      <StickySubmit form="defect-form" tone="red" disabled={pending}>
        <Send className="size-4" /> {pending ? "送信中..." : "報告を送信する"}
      </StickySubmit>
    </form>
  );
}
