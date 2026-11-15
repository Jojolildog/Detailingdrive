import Link from "next/link";
import type { CustomerVehicle } from "../../lib/customers.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
export function OwnedVehicles({ customerId, vehicles, locale }: { customerId: string; vehicles: CustomerVehicle[]; locale: Locale }) {
  const d = getDictionary(locale);
  return <section className="panel form-section"><div className="panel-heading owned-vehicle-heading"><h2>{d.customers.vehicles}</h2><div><span className="customer-vehicle-count">{vehicles.length}</span><Link className="button secondary" href={`/vehicles/new?customerId=${customerId}`}><Icon name="plus" size={15}/>{d.vehicles.add}</Link></div></div>
    {vehicles.length === 0 ? <div className="customer-related-empty"><Icon name="car" size={25}/><p>{d.customers.noVehicles}</p></div> : <ul className="customer-vehicles">{vehicles.map(vehicle => <li key={vehicle.id}><span className="section-icon"><Icon name="car"/></span><Link className="owned-vehicle-link" href={`/vehicles/${vehicle.id}`}><div><strong>{vehicle.manufacturer} {vehicle.model}</strong><span>{[vehicle.registrationNumber, vehicle.productionYear, vehicle.color].filter(Boolean).join(" · ") || d.vehicles.unavailable}</span></div><Icon name="chevron" size={17}/></Link></li>)}</ul>}
  </section>;
}
