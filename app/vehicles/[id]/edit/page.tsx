import { Application } from "../../../../server/application";
import { getVehicleDetail, getVehicleManufacturers } from "../../../../server/vehicles.ts";
import { getDictionary } from "../../../../lib/i18n";
import { VehicleForm } from "../../../../components/vehicles/vehicle-form";
export const dynamic = "force-dynamic";
export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Application section="vehicles" returnTo={`/vehicles/${id}/edit`} render={async ({ db, business }, settings) => {
    const [detail, manufacturers] = await Promise.all([getVehicleDetail(db, business.id, id), getVehicleManufacturers(db, business.id)]); const d = getDictionary(settings.locale);
    return { title: d.vehicles.editTitle, description: d.vehicles.editDescription, content: <VehicleForm key={`${detail.vehicle.id}:${detail.vehicle.version}`} vehicle={detail.vehicle} customer={detail.customer} locale={settings.locale} hasCustomers hasHistory={detail.serviceHistory.total > 0} manufacturers={manufacturers}/> };
  }}/>;
}
