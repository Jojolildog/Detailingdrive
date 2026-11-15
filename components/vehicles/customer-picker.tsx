"use client";
import { useEffect, useState } from "react";
import { isCustomer, isRecord } from "../../lib/customers.ts";
import type { Customer } from "../../lib/customers.ts";
import type { VehicleOwner } from "../../lib/vehicles.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
import { vehicleErrorText } from "./api";

export function CustomerPicker({ id = "vehicle-customerId", value, initialCustomer, onChange, onSelected, locale, required = false, error, errorMessage }: {
  id?: string; value: string; initialCustomer?: VehicleOwner; onChange: (id: string) => void; onSelected?: (customer?: VehicleOwner) => void; locale: Locale; required?: boolean; error?: string; errorMessage?: string;
}) {
  const d = getDictionary(locale); const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<VehicleOwner | undefined>(initialCustomer);
  const [result, setResult] = useState<{ items: Customer[]; page: number; totalPages: number; total: number }>({ items: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState("");
  useEffect(() => { if (initialCustomer?.id === value) setSelected(initialCustomer); }, [initialCustomer, value]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError("");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: search, page: String(page), pageSize: "20" });
        const response = await fetch(`/api/customers?${params}`, { credentials: "same-origin", signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok) { if (!controller.signal.aborted) setLoadError(isRecord(payload) && typeof payload.error === "string" ? payload.error : "customerOptionsUnavailable"); return; }
        if (!isRecord(payload) || !Array.isArray(payload.items) || typeof payload.page !== "number" || typeof payload.totalPages !== "number" || typeof payload.total !== "number") throw new Error("Invalid customer options");
        const items = payload.items.filter(isCustomer); if (items.length !== payload.items.length) throw new Error("Invalid customer record");
        if (!controller.signal.aborted) setResult({ items, page: payload.page, totalPages: payload.totalPages, total: payload.total });
      } catch { if (!controller.signal.aborted) setLoadError("customerOptionsUnavailable"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, page, retry]);
  const options: VehicleOwner[] = [...(selected ? [selected] : []), ...result.items.filter(customer => customer.id !== selected?.id)];
  return <div className="field vehicle-customer-picker" aria-busy={loading}>
    <label htmlFor={id}>{d.vehicles.customer}{required && <span className="optional">{d.vehicles.required}</span>}</label>
    <label className="sr-only" htmlFor={`${id}-search`}>{d.vehicles.findCustomer}</label>
    <div className="owner-search"><Icon name="search" size={16}/><input id={`${id}-search`} type="search" autoComplete="off" maxLength={200} placeholder={d.vehicles.findCustomer} value={search} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} onChange={event => { setSearch(event.target.value); setPage(1); }}/></div>
    <select id={id} name="customerId" required={required} value={value} aria-invalid={Boolean(error)} aria-describedby={`${id}-help`} onChange={event => { const next = options.find(customer => customer.id === event.target.value); setSelected(next); onChange(event.target.value); onSelected?.(next); }}>
      <option value="">{required ? d.vehicles.chooseCustomer : d.vehicles.allCustomers}</option>
      {value && !options.some(customer => customer.id === value) && <option value={value}>{d.vehicles.customerUnavailable}</option>}
      {options.map(customer => <option key={customer.id} value={customer.id}>{customer.fullName} · {customer.phoneNumber}</option>)}
    </select>
    <p id={`${id}-help`} className={error ? "field-error" : "field-hint"}>{error ? errorMessage ?? vehicleErrorText(d, error) : required ? d.vehicles.customerRequiredHint : d.vehicles.allCustomers}</p>
    {loadError ? <div className="owner-picker-error" role="alert"><span>{vehicleErrorText(d, loadError)}</span><button type="button" className="button secondary" onClick={() => setRetry(value => value + 1)}>{d.vehicles.retry}</button></div> : <div className="owner-picker-status"><span role="status">{loading ? d.vehicles.customerLoading : result.total === 0 ? d.vehicles.customerNoResults : `${result.total} ${d.customers.countLabel}`}</span>{result.totalPages > 1 && <div><button type="button" className="icon-button" disabled={loading || result.page <= 1} aria-label={d.vehicles.previous} onClick={() => setPage(result.page - 1)}><Icon name="back" size={15}/></button><span>{result.page} / {result.totalPages}</span><button type="button" className="icon-button" disabled={loading || result.page >= result.totalPages} aria-label={d.vehicles.next} onClick={() => setPage(result.page + 1)}><Icon name="arrow" size={15}/></button></div>}</div>}
  </div>;
}
