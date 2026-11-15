import Link from "next/link";
import { Application } from "../../server/application";
import { listVehicles, getVehicleManufacturers } from "../../server/vehicles.ts";
import { getCustomer } from "../../server/customers.ts";
import { ApplicationError } from "../../server/errors.ts";
import { parseVehicleQuery, vehicleListPath } from "../../lib/vehicles.ts";
import type { VehicleOwner } from "../../lib/vehicles.ts";
import { getDictionary } from "../../lib/i18n";
import { VehicleList } from "../../components/vehicles/vehicle-list";
export const dynamic = "force-dynamic";
export default async function VehiclesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams; const params = new URLSearchParams();
  for (const key of ["q", "customerId", "manufacturer", "sizeCategory", "productionYear", "sort", "page", "pageSize"]) { const value = values[key]; if (typeof value === "string") params.set(key, value); }
  const query = parseVehicleQuery(params);
  return <Application section="vehicles" returnTo={query ? vehicleListPath(query) : "/vehicles"} render={async ({ db, business }, settings) => {
    const d = getDictionary(settings.locale);
    if (!query) return { description: d.vehicles.description, content: <div className="panel form-section"><p role="alert">{d.vehicleErrors.invalidVehicleQuery}</p><Link className="button secondary" href="/vehicles">{d.vehicles.clearFilters}</Link></div> };
    let customer: VehicleOwner | undefined;
    if (query.customerId) {
      try { const row = await getCustomer(db, business.id, query.customerId); customer = { id: row.id, fullName: row.fullName, phoneNumber: row.phoneNumber, email: row.email }; }
      catch (error) { if (!(error instanceof ApplicationError && error.status === 404)) throw error; }
    }
    const [result, manufacturers] = await Promise.all([listVehicles(db, business.id, query), getVehicleManufacturers(db, business.id)]);
    return { description: d.vehicles.description, content: <VehicleList result={result} manufacturers={manufacturers} selectedCustomer={customer} locale={settings.locale}/> };
  }}/>;
}
