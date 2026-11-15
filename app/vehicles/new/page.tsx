import { Application } from "../../../server/application";
import { getCustomer, listCustomers } from "../../../server/customers.ts";
import { getVehicleManufacturers } from "../../../server/vehicles.ts";
import type { VehicleOwner } from "../../../lib/vehicles.ts";
import { getDictionary } from "../../../lib/i18n";
import { VehicleForm } from "../../../components/vehicles/vehicle-form";
export const dynamic = "force-dynamic";
export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams; const customerId = typeof values.customerId === "string" ? values.customerId : "";
  return <Application section="vehicles" returnTo={`/vehicles/new${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ""}`} render={async ({ db, business }, settings) => {
    const d = getDictionary(settings.locale); let customer: VehicleOwner | undefined;
    if (customerId) { const row = await getCustomer(db, business.id, customerId); customer = { id: row.id, fullName: row.fullName, phoneNumber: row.phoneNumber, email: row.email }; }
    const [customers, manufacturers] = await Promise.all([listCustomers(db, business.id, { query: "", sort: "name_asc", page: 1, pageSize: 1 }), getVehicleManufacturers(db, business.id)]);
    return { title: d.vehicles.newTitle, description: d.vehicles.newDescription, content: <VehicleForm customer={customer} locale={settings.locale} hasCustomers={customers.total > 0} manufacturers={manufacturers}/> };
  }}/>;
}
