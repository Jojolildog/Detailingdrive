"use client";
import Link from "next/link";
import { useState } from "react";
import { formatHuf, isService, MAX_SERVICE_PRICE } from "../../lib/services.ts";
import { MAX_SELECTED_SERVICES } from "../../lib/work-orders.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { useOptions } from "./use-options";
import { PickerStatus } from "./picker-status";
import { Icon } from "../detailflow/icon";
export type ChosenService = { key: string; serviceId: string | null; snapshotId?: string; serviceName: string; servicePrice: number };
export function ServicePicker({ selected, locale, onChange }: { selected: ChosenService[]; locale: Locale; onChange: (rows: ChosenService[]) => void }) {
  const d = getDictionary(locale); const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const result = useOptions(`/api/services?${new URLSearchParams({ status: "active", q: search, page: String(page), pageSize: "10" })}`, isService);
  return <div className="work-service-picker"><h3>{d.workOrders.chooseServices}</h3><label className="sr-only" htmlFor="work-service-search">{d.workOrders.findServices}</label><input id="work-service-search" type="search" value={search} maxLength={200} placeholder={d.workOrders.findServices} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} onChange={event => { setSearch(event.target.value); setPage(1); }}/>
    <div className="work-service-options" aria-busy={result.loading}>{result.items.map(service => { const chosen = selected.some(row => row.serviceId === service.id); return <div key={service.id}><span><strong>{service.serviceName}</strong><small>{service.defaultPrice === null ? d.workOrders.noPrice : formatHuf(service.defaultPrice, locale)}</small></span><button type="button" className="button secondary" disabled={result.loading || !service.active || service.defaultPrice === null || service.defaultPrice > MAX_SERVICE_PRICE || chosen || selected.length >= MAX_SELECTED_SERVICES} onClick={() => { if (service.defaultPrice !== null) onChange([...selected, { key: `service:${service.id}`, serviceId: service.id, serviceName: service.serviceName, servicePrice: service.defaultPrice }]); }} aria-label={`${d.workOrders.addService}: ${service.serviceName}`}><Icon name={chosen ? "check" : "plus"} size={16}/>{d.workOrders.addService}</button></div>; })}</div>
    {!result.loading && !result.error && result.total === 0 && <p className="field-hint">{d.workOrders.noServices}</p>}<PickerStatus d={d} result={result} page={page} onPage={setPage}/><Link className="contact-link" href="/services/new" target="_blank" rel="noopener noreferrer">{d.services.add}</Link>
  </div>;
}
