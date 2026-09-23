import { ImportView } from "./import-view";

export const metadata = { title: "一括取り込み" };

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const { kind } = await searchParams;
  return <ImportView initialKind={kind === "vehicles" ? "vehicles" : "drivers"} />;
}
