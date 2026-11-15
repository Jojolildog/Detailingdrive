"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isRecord } from "../../lib/customers.ts";
import { emptyVehicle, isVehicle, modelYearLimit, validateVehicle, vehicleFields, vehicleSizes } from "../../lib/vehicles.ts";
import type { Vehicle, VehicleErrors, VehicleField, VehicleInput, VehicleOwner } from "../../lib/vehicles.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { useUnsavedChanges } from "../detailflow/unsaved-changes";
import { Icon } from "../detailflow/icon";
import { CustomerPicker } from "./customer-picker";
import { vehicleApiErrors, vehicleErrorText } from "./api";
type Draft = Omit<VehicleInput, "productionYear"> & { productionYear: string };
function toDraft(value: VehicleInput): Draft { return { ...value, productionYear: value.productionYear?.toString() ?? "" }; }

export function VehicleForm({ vehicle, customer, locale, hasCustomers, hasHistory = false, manufacturers }: {
  vehicle?: Vehicle; customer?: VehicleOwner; locale: Locale; hasCustomers: boolean; hasHistory?: boolean; manufacturers: string[];
}) {
  const d = getDictionary(locale); const router = useRouter(); const setUnsaved = useUnsavedChanges();
  const initial = toDraft(vehicle ?? { ...emptyVehicle, customerId: customer?.id ?? "" });
  const [draft, setDraft] = useState<Draft>(initial); const [errors, setErrors] = useState<VehicleErrors>({}); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const dirty = !saved && JSON.stringify(draft) !== JSON.stringify(initial); const cancelPath = vehicle ? `/vehicles/${vehicle.id}` : "/vehicles";
  useEffect(() => { setUnsaved(dirty); return () => setUnsaved(false); }, [dirty, setUnsaved]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined, form: undefined })); }
  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) { if (dirty && !window.confirm(d.vehicles.leave)) event.preventDefault(); }
  function report(value: VehicleErrors) { setErrors(value); const field = vehicleFields.find(key => value[key]); if (field) requestAnimationFrame(() => document.getElementById(`vehicle-${field}`)?.focus()); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateVehicle({ ...draft, productionYear: draft.productionYear.trim() ? Number(draft.productionYear) : null, ...(vehicle ? { version: vehicle.version } : {}) }, Boolean(vehicle));
    if (!parsed.success) { report(parsed.errors); return; }
    setSaving(true); setErrors({});
    try {
      const response = await fetch(vehicle ? `/api/vehicles/${vehicle.id}` : "/api/vehicles", { method: vehicle ? "PUT" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.data, ...(vehicle ? { version: vehicle.version } : {}) }) });
      const payload: unknown = await response.json();
      if (!response.ok) { report(vehicleApiErrors(payload)); return; }
      if (!isRecord(payload) || !isVehicle(payload.vehicle)) throw new Error("Invalid vehicle response");
      setSaved(true); setUnsaved(false); router.replace(`/vehicles/${payload.vehicle.id}`); router.refresh();
    } catch { setErrors({ form: "unexpected" }); }
    finally { setSaving(false); }
  }
  if (!hasCustomers) return <section className="panel customers-empty"><span className="module-icon"><Icon name="users" size={30}/></span><h2>{d.vehicles.noCustomersTitle}</h2><p>{d.vehicles.noCustomersBody}</p><Link href="/customers/new" className="button primary">{d.vehicles.createCustomer}<Icon name="plus" size={17}/></Link></section>;
  const fields: { key: Exclude<VehicleField, "customerId" | "sizeCategory" | "notes">; label: string; required: boolean; maxLength?: number }[] = [
    { key: "manufacturer", label: d.vehicles.manufacturer, required: true, maxLength: 100 }, { key: "model", label: d.vehicles.model, required: true, maxLength: 120 },
    { key: "productionYear", label: d.vehicles.productionYear, required: false }, { key: "registrationNumber", label: d.vehicles.registrationNumber, required: false, maxLength: 20 }, { key: "color", label: d.vehicles.color, required: false, maxLength: 80 },
  ];
  return <div className="customer-form-wrap"><Link href={cancelPath} className="back-link" onClick={confirmLeave}><Icon name="back" size={16}/>{d.vehicles.back}</Link>
    <form onSubmit={submit} className="customer-form vehicle-form" noValidate><fieldset disabled={saving} className="settings-fieldset">
      <section className="panel form-section">{hasHistory && customer ? <div className="vehicle-locked-owner"><h2>{d.vehicles.customer}</h2><Link href={`/customers/${customer.id}`}>{customer.fullName}<Icon name="arrow" size={16}/></Link><p className="field-hint">{d.vehicles.ownerLocked}</p></div> : <CustomerPicker value={draft.customerId} initialCustomer={customer} locale={locale} required onChange={value => change("customerId", value)} error={errors.customerId}/>}</section>
      <section className="panel form-section"><div className="section-heading"><span className="section-icon"><Icon name="car"/></span><h2>{d.vehicles.information}</h2></div><div className="vehicle-fields">
        {fields.map(field => <div className="field" key={field.key}><label htmlFor={`vehicle-${field.key}`}>{field.label}<span className="optional">{field.required ? d.vehicles.required : d.vehicles.optional}</span></label><input id={`vehicle-${field.key}`} name={field.key} type={field.key === "productionYear" ? "number" : "text"} min={field.key === "productionYear" ? 1886 : undefined} max={field.key === "productionYear" ? modelYearLimit() : undefined} step={field.key === "productionYear" ? 1 : undefined} maxLength={field.maxLength} autoComplete="off" list={field.key === "manufacturer" ? "vehicle-makes" : undefined} value={draft[field.key] ?? ""} required={field.required} onChange={event => change(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}/>{errors[field.key] && <p className="field-error" id={`${field.key}-error`}>{vehicleErrorText(d, errors[field.key])}</p>}</div>)}
        <div className="field"><label htmlFor="vehicle-sizeCategory">{d.vehicles.sizeCategory}<span className="optional">{d.vehicles.required}</span></label><select id="vehicle-sizeCategory" value={draft.sizeCategory} onChange={event => change("sizeCategory", event.target.value as VehicleInput["sizeCategory"])} aria-invalid={Boolean(errors.sizeCategory)} aria-describedby="vehicle-size-help">{vehicleSizes.map(size => <option key={size} value={size}>{d.vehicles[size]}</option>)}</select><p className={errors.sizeCategory ? "field-error" : "field-hint"} id="vehicle-size-help">{errors.sizeCategory ? vehicleErrorText(d, errors.sizeCategory) : d.vehicles.sizeHint}</p></div>
      </div><datalist id="vehicle-makes">{manufacturers.map(make => <option value={make} key={make}/>)}</datalist></section>
      <section className="panel form-section"><div className="field"><label htmlFor="vehicle-notes">{d.vehicles.notes}<span className="optional">{d.vehicles.optional}</span></label><textarea id="vehicle-notes" rows={6} maxLength={10000} value={draft.notes} onChange={event => change("notes", event.target.value)} aria-invalid={Boolean(errors.notes)} aria-describedby="vehicle-notes-help"/><p id="vehicle-notes-help" className={errors.notes ? "field-error" : "field-hint"}>{errors.notes ? vehicleErrorText(d, errors.notes) : d.vehicles.notesHint}</p></div></section>
    </fieldset>{Object.values(errors).some(Boolean) && <div className="notice error-notice" role="alert">{errors.form ? vehicleErrorText(d, errors.form) : d.vehicles.validationTitle}</div>}{errors.form === "vehicleConflict" && <button type="button" className="button secondary" onClick={() => { if (window.confirm(d.vehicles.leave)) window.location.reload(); }}>{d.vehicles.reload}</button>}
    <div className="customer-form-actions"><Link href={cancelPath} className="button secondary" aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); else confirmLeave(event); }}>{d.vehicles.cancel}</Link><button className="button primary" type="submit" disabled={saving || saved}>{saving ? d.vehicles.saving : d.vehicles.save}<Icon name="check" size={17}/></button></div></form>
  </div>;
}
