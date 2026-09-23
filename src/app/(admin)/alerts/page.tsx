import { buildAlertMessage } from "@/lib/alerts";
import { loadAll } from "@/lib/data";
import { AlertsView } from "./alerts-view";

export const metadata = { title: "期限アラート管理" };

export default async function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  const { focus } = await searchParams;
  const { alerts } = await loadAll();
  return (
    <AlertsView
      focus={typeof focus === "string" ? focus : null}
      alerts={alerts.map((a) => ({
        key: a.key,
        kind: a.kind,
        severity: a.severity,
        summary: a.summary,
        driverName: a.driver?.name ?? null,
        lineLinked: Boolean(a.driver?.line_user_id),
        plate: a.vehicle?.plate ?? null,
        lastManualNotice: a.lastManualNotice,
        message: buildAlertMessage(a),
      }))}
    />
  );
}
