import { ToastProvider } from "@/components/toast";
import { loadAll } from "@/lib/data";
import { isSheetsMode } from "@/lib/repo";
import { Sidebar } from "./sidebar";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { alerts, defects } = await loadAll();
  return (
    <ToastProvider>
      <div className="min-h-screen lg:flex">
        <Sidebar
          alertCount={alerts.filter((a) => a.waitingOn === "admin").length}
          defectCount={defects.filter((d) => d.status === "open").length}
          demo={!isSheetsMode()}
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
