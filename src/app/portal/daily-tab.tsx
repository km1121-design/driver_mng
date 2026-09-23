"use client";

import { CheckCircle2, Droplet, Gauge, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { useActionFeedback } from "@/components/toast";
import { THRESHOLDS } from "@/lib/config";
import { daysSince } from "@/lib/date";
import { submitDailyReport } from "./actions";
import { PhotoPicker } from "./photo-picker";
import { StickySubmit, type PortalVehicle } from "./portal-app";

export function DailyTab({
  token,
  vehicle,
  lastReportAt,
}: {
  token: string;
  vehicle: PortalVehicle | null;
  lastReportAt: string | null;
}) {
  const [formKey, setFormKey] = useState(0);
  return <DailyForm key={formKey} token={token} vehicle={vehicle} lastReportAt={lastReportAt} onDone={() => setFormKey((k) => k + 1)} />;
}

function DailyForm({
  token,
  vehicle,
  lastReportAt,
  onDone,
}: {
  token: string;
  vehicle: PortalVehicle | null;
  lastReportAt: string | null;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(submitDailyReport, null);
  const [oil, setOil] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  useActionFeedback(state, onDone);

  if (!vehicle) {
    return <p className="card p-6 text-center text-sm text-slate-500">担当車両が割り当てられていません。管理者にご連絡ください。</p>;
  }
  const sinceOil = vehicle.current_mileage - vehicle.last_oil_mileage;
  const days = lastReportAt ? daysSince(lastReportAt) : null;

  return (
    <form
      id="daily-form"
      action={(fd) => {
        const mileage = Number(String(fd.get("mileage")).replaceAll(",", ""));
        if (mileage - vehicle.current_mileage > 5000) {
          if (!confirm(`前回から ${(mileage - vehicle.current_mileage).toLocaleString()}km 増えています。この値で正しいですか？`)) return;
          fd.set("confirm_large", "1");
        }
        if (photo) fd.set("oil_photo", photo);
        action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />

      {sinceOil >= THRESHOLDS.oilChangeKm && (
        <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs font-bold text-orange-700">
          前回のオイル交換から {sinceOil.toLocaleString()}km 走行しています。交換をお願いします。
        </p>
      )}

      <section className="card p-5">
        <h2 className="mb-4 flex items-center text-sm font-bold">
          <Gauge className="mr-2 size-4 text-blue-500" /> 現在のメーター (走行距離)
        </h2>
        <div className="mb-2 flex items-end gap-2">
          <input
            name="mileage"
            type="number"
            inputMode="numeric"
            required
            min={vehicle.current_mileage}
            placeholder={String(vehicle.current_mileage)}
            className="w-full border-b-2 border-slate-300 bg-transparent py-1 text-right text-3xl font-bold outline-none focus:border-blue-500"
          />
          <span className="pb-2 font-bold text-slate-500">km</span>
        </div>
        <p className="text-right text-[11px] text-slate-400">
          ※前回報告: {vehicle.current_mileage.toLocaleString()} km
          {days !== null && ` (${days === 0 ? "今日" : `${days}日前`})`}
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center text-sm font-bold">
          <CheckCircle2 className="mr-2 size-4 text-green-500" /> 状態チェック
        </h2>
        {[
          ["tire_ok", "タイヤの空気圧・溝は正常"],
          ["lights_brakes_ok", "ランプ類・ブレーキ異常なし"],
        ].map(([name, label]) => (
          <label key={name} className="mb-2 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 last:mb-0">
            <input type="checkbox" name={name} className="size-5 accent-blue-600" />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </label>
        ))}
        <p className="mt-2 text-[11px] text-slate-400">異常がある場合はチェックを外して送信し、「車両報告」タブから詳細をお知らせください。</p>
      </section>

      <section className="card p-5">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="is_oil_changed" checked={oil} onChange={(e) => setOil(e.target.checked)} className="size-5 accent-blue-600" />
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <Droplet className="size-4 text-amber-500" /> 本日、オイル交換を実施した
          </span>
        </label>
        {oil && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">交換時のレシートやシールを撮影</p>
            <PhotoPicker label="写真を撮る" file={photo} onChange={setPhoto} compact />
          </div>
        )}
      </section>

      <StickySubmit form="daily-form" disabled={pending}>
        <Send className="size-4" /> {pending ? "送信中..." : "定期報告を送信する"}
      </StickySubmit>
    </form>
  );
}
