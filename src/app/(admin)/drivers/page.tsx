import { loadAll } from "@/lib/data";
import { APP_BASE_URL } from "@/lib/config";
import { DriversView, type LicensePhotos } from "./drivers-view";

export const metadata = { title: "ドライバー台帳" };

export default async function DriversPage() {
  const { drivers, vehicles, reports, documents } = await loadAll();
  const lastReport: Record<string, string> = {};
  for (const r of reports) {
    if (!lastReport[r.driver_id] || lastReport[r.driver_id] < r.date) lastReport[r.driver_id] = r.date;
  }
  // 最新の免許証画像 (日付の古い順に上書き)
  const licensePhotos: LicensePhotos = {};
  for (const doc of [...documents].sort((a, b) => a.date.localeCompare(b.date))) {
    if (doc.doc_type !== "license_front" && doc.doc_type !== "license_back") continue;
    const p = (licensePhotos[doc.driver_id] ??= {});
    p[doc.doc_type === "license_front" ? "front" : "back"] = doc.file_url;
    p.date = doc.date;
  }
  return (
    <DriversView
      drivers={drivers}
      vehicles={vehicles}
      lastReport={lastReport}
      licensePhotos={licensePhotos}
      baseUrl={APP_BASE_URL}
    />
  );
}
