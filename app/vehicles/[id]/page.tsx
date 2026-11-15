import Link from "next/link";
import { Application } from "../../../server/application";
import { getVehicleDetail } from "../../../server/vehicles.ts";
import { parseHistoryPage } from "../../../lib/vehicles.ts";
import { getDictionary } from "../../../lib/i18n";
import { VehicleDetail } from "../../../components/vehicles/vehicle-detail";
export const dynamic = "force-dynamic";
export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params; const values = await searchParams;
  const query = new URLSearchParams(); if (typeof values.historyPage === "string") query.set("historyPage", values.historyPage); const page = parseHistoryPage(query);
  return <Application section="vehicles" returnTo={`/vehicles/${id}${page && page > 1 ? `?historyPage=${page}` : ""}`} render={async ({ db, business }, settings) => {
    const d = getDictionary(settings.locale);
    if (page === null) return { content: <div className="panel form-section"><p role="alert">{d.vehicleErrors.invalidVehicleQuery}</p><Link className="button secondary" href={`/vehicles/${id}`}>{d.vehicles.reload}</Link></div> };
    const detail = await getVehicleDetail(db, business.id, id, page);
    return { title: `${detail.vehicle.manufacturer} ${detail.vehicle.model}`, description: d.vehicles.detailDescription, content: <VehicleDetail detail={detail} locale={settings.locale}/> };
  }}/>;
}
