"use client";

import { Camera, CircleCheck, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image";

/** スマホのカメラを起動して1枚撮影・プレビューする */
export function PhotoPicker({
  label,
  file,
  onChange,
  compact = false,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const preview = picked && picked.file === file ? picked.url : null;

  // アンマウント時・差し替え時にプレビューURLを解放する
  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const c = await compressImage(f);
          setPicked({ file: c, url: URL.createObjectURL(c) });
          onChange(c);
        }}
      />
      {file ? (
        <div className="relative overflow-hidden rounded-xl border border-green-200 bg-green-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className={`w-full object-cover ${compact ? "h-28" : "h-40"}`} />
          ) : (
            <p className="p-4 text-sm">{file.name}</p>
          )}
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
            <CircleCheck className="size-3" /> セット完了
          </span>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow"
          >
            <RotateCcw className="size-3" /> 撮り直す
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition active:bg-slate-100 ${
            compact ? "py-5" : "py-8"
          }`}
        >
          <Camera className={`${compact ? "size-6" : "size-8"} mb-1.5`} />
          <span className="text-xs font-bold">{label}</span>
        </button>
      )}
    </>
  );
}
