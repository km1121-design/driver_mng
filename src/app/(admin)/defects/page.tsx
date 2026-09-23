import { PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/date";
import { loadAll } from "@/lib/data";
import { ResolveButton } from "./resolve-button";

export const metadata = { title: "車両報告" };

export default async function DefectsPage() {
  const { defects, drivers, vehicles } = await loadAll();
  const name = new Map(drivers.map((d) => [d.id, d.name]));
  const plate = new Map(vehicles.map((v) => [v.id, v.plate]));
  const sorted = [...defects].sort(
    (a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === "open" ? -1 : 1),
  );

  return (
    <>
      <PageHeader title="車両報告 (キズ・不具合)" description="ドライバーから届いた非緊急の報告です。" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((d) => (
          <article key={d.id} className={`card p-5 ${d.status === "resolved" ? "opacity-60" : ""}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{d.location}</p>
                <p className="text-xs text-slate-500">
                  {plate.get(d.vehicle_id) ?? "車両不明"} / {name.get(d.driver_id) ?? "—"}
                </p>
              </div>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${d.status === "open" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                {d.status === "open" ? "未対応" : "対応済"}
              </span>
            </div>
            {d.note && <p className="mb-3 whitespace-pre-wrap text-sm text-slate-600">{d.note}</p>}
            {d.photo_urls && (
              <div className="mb-3 flex flex-wrap gap-2">
                {d.photo_urls.split("\n").map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="rounded border border-slate-200 px-2 py-1 text-xs text-blue-600">
                    写真{i + 1}
                  </a>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{formatDateTime(d.date)}</span>
              {d.status === "open" && <ResolveButton id={d.id} />}
            </div>
          </article>
        ))}
        {sorted.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-400">報告はありません</p>}
      </div>
    </>
  );
}
