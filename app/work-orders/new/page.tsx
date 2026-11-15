import { Application } from "../../../server/application";
import { getCustomer } from "../../../server/customers.ts";
import { getVehicle } from "../../../server/vehicles.ts";
import { ApplicationError } from "../../../server/errors.ts";
import { getDictionary } from "../../../lib/i18n";
import { WorkOrderForm } from "../../../components/work-orders/work-order-form";
export const dynamic = "force-dynamic";
export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams; const customerId = typeof values.customerId === "string" ? values.customerId : ""; const vehicleId = typeof values.vehicleId === "string" ? values.vehicleId : "";
  const params = new URLSearchParams(); if (customerId) params.set("customerId", customerId); if (vehicleId) params.set("vehicleId", vehicleId);
  return <Application section="workOrders" returnTo={`/work-orders/new${params.size ? `?${params}` : ""}`} render={async ({ db, business }, settings) => {
    const d = getDictionary(settings.locale); const vehicle = vehicleId ? await getVehicle(db, business.id, vehicleId) : undefined;
    if (customerId && vehicle && vehicle.customerId !== customerId) throw new ApplicationError(404, "workOrderNotFound");
    const ownerId = customerId || vehicle?.customerId; const customer = ownerId ? await getCustomer(db, business.id, ownerId) : undefined;
    return { title: d.workOrders.newTitle, description: d.workOrders.newDescription, content: <WorkOrderForm locale={settings.locale} initialCustomer={customer} initialVehicle={vehicle}/> };
  }}/>;
}
