"use client";
import Link from "next/link";
import { useState } from "react";
import { isVehicle } from "../../lib/vehicles.ts";
import type { Vehicle } from "../../lib/vehicles.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { useOptions } from "./use-options";
import { PickerStatus } from "./picker-status";
import { workOrderErrorText } from "./api";
export function VehiclePicker({ customerId, value, selected, locale, onChange, error }: { customerId: string; value: string; selected?: Vehicle; locale: Locale; onChange: (value?: Vehicle) => void; error?: string }) {
  const d = getDictionary(locale); const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const result = useOptions(customerId ? `/api/vehicles?${new URLSearchParams({ customerId, q: search, page: String(page), pageSize: "20" })}` : null, isVehicle);
  const options = [...(selected?.customerId === customerId ? [selected] : []), ...result.items.filter(vehicle => vehicle.customerId === customerId && vehicle.id !== selected?.id)];
  return <div className="field" aria-busy={result.loading}><label htmlFor="work-vehicleId">{d.workOrders.vehicle}<span className="optional">{d.workOrders.required}</span></label>{!customerId ? <p className="field-hint">{d.workOrders.chooseCustomerFirst}</p> : <><label className="sr-only" htmlFor="work-vehicle-search">{d.workOrders.findVehicle}</label><input id="work-vehicle-search" type="search" value={search} maxLength={200} placeholder={d.workOrders.findVehicle} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} onChange={event => { setSearch(event.target.value); setPage(1); }}/></>}
    <select id="work-vehicleId" required disabled={!customerId} value={value} onChange={event => onChange(options.find(vehicle => vehicle.id === event.target.value))} aria-invalid={Boolean(error)} aria-describedby="work-vehicle-help"><option value="">{d.workOrders.chooseVehicle}</option>{value && !options.some(row => row.id === value) && <option value={value}>{d.workOrders.unset}</option>}{options.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.manufacturer} {vehicle.model}{vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ""}</option>)}</select>
    <p className={error ? "field-error" : "field-hint"} id="work-vehicle-help">{error ? workOrderErrorText(d, error) : d.vehicles.customerRequiredHint}</p>{customerId && <><PickerStatus d={d} result={result} page={page} onPage={setPage}/>{!result.loading && !result.error && result.total === 0 && <p className="field-hint">{d.workOrders.noVehicles}</p>}<Link className="contact-link" href={`/vehicles/new?customerId=${customerId}`} target="_blank" rel="noopener noreferrer">{d.vehicles.add}</Link></>}
  </div>;
}
