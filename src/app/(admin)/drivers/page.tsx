import { loadAll } from "@/lib/data";
import { APP_BASE_URL } from "@/lib/config";
import { DriversView } from "./drivers-view";

export const metadata = { title: "ドライバー台帳" };

export default async function DriversPage() {
  const { drivers, vehicles, reports } = await loadAll();
  const lastReport: Record<string, string> = {};
  for (const r of reports) {
    if (!lastReport[r.driver_id] || lastReport[r.driver_id] < r.date) lastReport[r.driver_id] = r.date;
  }
  return (
    <DriversView drivers={drivers} vehicles={vehicles} lastReport={lastReport} baseUrl={APP_BASE_URL} />
  );
}
