import { loadAll } from "@/lib/data";
import { VehiclesView } from "./vehicles-view";

export const metadata = { title: "車両・車検管理" };

export default async function VehiclesPage() {
  const { drivers, vehicles, documents } = await loadAll();
  return <VehiclesView drivers={drivers} vehicles={vehicles} documents={documents} />;
}
