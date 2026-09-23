import { ShieldAlert } from "lucide-react";
import { ToastProvider } from "@/components/toast";
import { resolvePortal } from "@/lib/data";
import { getRepo } from "@/lib/repo";
import { PortalApp } from "./portal-app";

export const metadata = { title: "ドライバーポータル" };

export default async function PortalPage({ searchParams }: PageProps<"/portal">) {
  const sp = await searchParams;
  const token = typeof sp.id === "string" ? sp.id : "";
  const portal = await resolvePortal(token);

  if (!portal) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="card max-w-sm p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 size-10 text-slate-400" />
          <h1 className="mb-2 font-bold">URLが無効です</h1>
          <p className="text-sm text-slate-500">
            LINE のメニュー、または LINE で届いた専用URLから開き直してください。解決しない場合は管理者へご連絡ください。
          </p>
        </div>
      </main>
    );
  }

  const { driver, vehicle } = portal;
  const reports = (await getRepo().list("daily_reports"))
    .filter((r) => r.driver_id === driver.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const doc = typeof sp.doc === "string" ? sp.doc : undefined;

  return (
    <ToastProvider>
      <PortalApp
        token={token}
        driver={{
          name: driver.name,
          type: driver.type,
          phone: driver.phone,
          email: driver.email,
          emergency_contact_name: driver.emergency_contact_name,
          emergency_contact_phone: driver.emergency_contact_phone,
          license_expiry: driver.license_expiry,
          license_number: driver.license_number,
          license_class: driver.license_class,
          license_conditions: driver.license_conditions,
        }}
        vehicle={
          vehicle && {
            plate: vehicle.plate,
            car_type: vehicle.car_type,
            usage_type: vehicle.usage_type,
            current_mileage: vehicle.current_mileage,
            last_oil_mileage: vehicle.last_oil_mileage,
            inspection_expiry: vehicle.inspection_expiry,
            insurance_expiry: vehicle.insurance_expiry,
          }
        }
        lastReportAt={reports[0]?.date ?? null}
        initialTab={tab === "docs" || tab === "defect" ? tab : "daily"}
        initialDoc={doc === "license" || doc === "vehicle" || doc === "contact" ? doc : null}
        adminPhone={process.env.ADMIN_PHONE ?? ""}
      />
    </ToastProvider>
  );
}
