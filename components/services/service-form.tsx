"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isRecord } from "../../lib/customers.ts";
import { isService, materialUnits, MAX_MATERIALS, validateService, serviceFields } from "../../lib/services.ts";
import type { Service, ServiceErrors, MaterialErrors, MaterialUnit } from "../../lib/services.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { useUnsavedChanges } from "../detailflow/unsaved-changes";
import { Icon } from "../detailflow/icon";
import { serviceApiErrors, serviceErrorText } from "./api";

type MaterialDraft = { key: number; name: string; quantity: string; unit: MaterialUnit };
type Draft = { serviceName: string; description: string; defaultPrice: string; expectedDuration: string; optionalCostEstimate: string; active: boolean; expectedMaterials: MaterialDraft[] };
function toDraft(service?: Service): Draft {
  return { serviceName: service?.serviceName ?? "", description: service?.description ?? "", defaultPrice: service?.defaultPrice?.toString() ?? "", expectedDuration: service?.expectedDuration?.toString() ?? "", optionalCostEstimate: service?.optionalCostEstimate?.toString() ?? "", active: service?.active ?? true, expectedMaterials: service?.expectedMaterials.map((row, key) => ({ ...row, key, quantity: row.quantity?.toString() ?? "" })) ?? [] };
}
// Number() accepts exponent and hexadecimal input; the form accepts ordinary decimal notation only.
function decimal(text: string): number | null { return text.trim() ? (/^\d+(?:[.,]\d+)?$/u.test(text.trim()) ? Number(text.replace(",", ".")) : NaN) : null; }

export function ServiceForm({ service, locale }: { service?: Service; locale: Locale }) {
  const d = getDictionary(locale); const router = useRouter(); const setUnsaved = useUnsavedChanges();
  const [initial] = useState(() => toDraft(service)); const [draft, setDraft] = useState<Draft>(initial);
  const [nextKey, setNextKey] = useState(initial.expectedMaterials.length);
  const [errors, setErrors] = useState<ServiceErrors>({}); const [materialErrors, setMaterialErrors] = useState<MaterialErrors>({});
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const dirty = !saved && JSON.stringify(draft) !== JSON.stringify(initial); const cancelPath = service ? `/services/${service.id}` : "/services";
  useEffect(() => { setUnsaved(dirty); return () => setUnsaved(false); }, [dirty, setUnsaved]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined, form: undefined })); }
  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) { if (saving || (dirty && !window.confirm(d.services.leave))) event.preventDefault(); }
  function changeMaterial(index: number, values: Partial<MaterialDraft>) {
    change("expectedMaterials", draft.expectedMaterials.map((row, i) => i === index ? { ...row, ...values } : row));
    setMaterialErrors(current => { const next = { ...current }; delete next[index]; return next; });
  }
  function report(value: ServiceErrors, rows: MaterialErrors = {}) {
    setErrors(value); setMaterialErrors(rows);
    const field = serviceFields.find(key => value[key]);
    requestAnimationFrame(() => {
      const rowIndex = Object.keys(rows)[0]; const row = rowIndex === undefined ? undefined : rows[Number(rowIndex)];
      const rowField = row ? (["name", "quantity", "unit"] as const).find(key => row[key]) : undefined;
      document.getElementById(field === "expectedMaterials" && rowField ? `material-${rowIndex}-${rowField}` : field ? `service-${field}` : "service-errors")?.focus();
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || saved) return;
    const parsed = validateService({ ...draft, defaultPrice: decimal(draft.defaultPrice), expectedDuration: decimal(draft.expectedDuration), optionalCostEstimate: decimal(draft.optionalCostEstimate), expectedMaterials: draft.expectedMaterials.map(({ name, quantity, unit }) => ({ name, quantity: decimal(quantity), unit })), ...(service ? { version: service.version } : {}) }, Boolean(service));
    if (!parsed.success) { report(parsed.errors, parsed.materialErrors); return; }
    setSaving(true); setErrors({}); setMaterialErrors({});
    try {
      const response = await fetch(service ? `/api/services/${service.id}` : "/api/services", { method: service ? "PUT" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.data, ...(service ? { version: service.version } : {}) }) });
      const payload: unknown = await response.json();
      if (!response.ok) { const result = serviceApiErrors(payload); report(result.errors, result.materialErrors); return; }
      if (!isRecord(payload) || !isService(payload.service)) throw new Error("Invalid service response");
      setSaved(true); setUnsaved(false); router.replace(`/services/${payload.service.id}`); router.refresh();
    } catch { report({ form: "unexpected" }); } finally { setSaving(false); }
  }
  const numbers = [
    { key: "defaultPrice", label: d.services.defaultPrice, hint: d.services.priceHint, required: true, error: errors.defaultPrice },
    { key: "expectedDuration", label: d.services.expectedDuration, hint: d.services.durationHint, required: false, error: errors.expectedDuration },
    { key: "optionalCostEstimate", label: d.services.optionalCostEstimate, hint: d.services.costHint, required: false, error: errors.optionalCostEstimate },
  ] as const;
  return <div className="customer-form-wrap"><Link href={cancelPath} className="back-link" onClick={confirmLeave}><Icon name="back" size={16}/>{d.services.back}</Link>
    <form className="customer-form" noValidate onSubmit={submit}><fieldset className="settings-fieldset" disabled={saving || saved}>
      <section className="panel form-section"><div className="section-heading"><span className="section-icon"><Icon name="sparkles"/></span><h2>{d.services.information}</h2></div>
        <div className="field"><label htmlFor="service-serviceName">{d.services.serviceName}<span className="optional">{d.services.required}</span></label><input id="service-serviceName" name="serviceName" required maxLength={160} value={draft.serviceName} onChange={event => change("serviceName", event.target.value)} aria-invalid={Boolean(errors.serviceName)} aria-describedby={errors.serviceName ? "service-name-error" : undefined}/>{errors.serviceName && <p id="service-name-error" className="field-error">{serviceErrorText(d, errors.serviceName)}</p>}</div>
        <div className="field"><label htmlFor="service-description">{d.services.descriptionLabel}<span className="optional">{d.services.optional}</span></label><textarea id="service-description" rows={4} maxLength={10000} value={draft.description} onChange={event => change("description", event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby="service-description-help"/><p id="service-description-help" className={errors.description ? "field-error" : "field-hint"}>{errors.description ? serviceErrorText(d, errors.description) : d.services.descriptionHint}</p></div>
        <label className="service-active-toggle" htmlFor="service-active"><input id="service-active" type="checkbox" checked={draft.active} onChange={event => change("active", event.target.checked)}/><span><strong>{d.services.active}</strong><small>{d.services.activeHint}</small></span></label>{errors.active && <p className="field-error">{serviceErrorText(d, errors.active)}</p>}
      </section>
      <section className="panel form-section"><div className="service-price-fields">{numbers.map(field => <div className="field" key={field.key}><label htmlFor={`service-${field.key}`}>{field.label}<span className="optional">{field.required ? d.services.required : d.services.optional}</span></label><input id={`service-${field.key}`} name={field.key} type="text" inputMode="numeric" required={field.required} maxLength={12} value={draft[field.key]} onChange={event => change(field.key, event.target.value)} aria-invalid={Boolean(field.error)} aria-describedby={`service-${field.key}-help`}/><p id={`service-${field.key}-help`} className={field.error ? "field-error" : "field-hint"}>{field.error ? serviceErrorText(d, field.error) : field.hint}</p></div>)}</div></section>
      <section className="panel form-section"><div className="panel-heading"><h2>{d.services.expectedMaterials}</h2><span className="step-badge">{draft.expectedMaterials.length} / {MAX_MATERIALS}</span></div><p id="service-materials-help" className="field-hint">{d.services.materialsHint}</p>
        <div id="service-expectedMaterials" tabIndex={-1} aria-describedby="service-materials-help" className="material-editor">{draft.expectedMaterials.length === 0 && <p className="muted">{d.services.noMaterials}</p>}{draft.expectedMaterials.map((row, index) => <div className="material-row" key={row.key}>
          <div className="field"><label htmlFor={`material-${index}-name`}>{d.services.materialName}<span className="optional">{d.services.required}</span></label><input id={`material-${index}-name`} value={row.name} maxLength={120} onChange={event => changeMaterial(index, { name: event.target.value })} aria-invalid={Boolean(materialErrors[index]?.name)} aria-describedby={materialErrors[index]?.name ? `material-${index}-name-error` : undefined}/>{materialErrors[index]?.name && <p id={`material-${index}-name-error`} className="field-error">{serviceErrorText(d, materialErrors[index].name)}</p>}</div>
          <div className="field"><label htmlFor={`material-${index}-quantity`}>{d.services.quantity}<span className="optional">{d.services.optional}</span></label><input id={`material-${index}-quantity`} inputMode="decimal" value={row.quantity} maxLength={14} onChange={event => changeMaterial(index, { quantity: event.target.value })} aria-invalid={Boolean(materialErrors[index]?.quantity)} aria-describedby={`material-${index}-quantity-help`}/><p id={`material-${index}-quantity-help`} className={materialErrors[index]?.quantity ? "field-error" : "field-hint"}>{materialErrors[index]?.quantity ? serviceErrorText(d, materialErrors[index].quantity) : d.services.quantityHint}</p></div>
          <div className="field"><label htmlFor={`material-${index}-unit`}>{d.services.unit}</label><select id={`material-${index}-unit`} value={row.unit} onChange={event => changeMaterial(index, { unit: event.target.value as MaterialUnit })} aria-invalid={Boolean(materialErrors[index]?.unit)}>{materialUnits.map(unit => <option key={unit} value={unit}>{d.services.units[unit]}</option>)}</select></div>
          <button type="button" className="icon-button customer-delete material-remove" aria-label={`${d.services.removeMaterial}: ${index + 1}`} onClick={() => { change("expectedMaterials", draft.expectedMaterials.filter((_, i) => i !== index)); setMaterialErrors({}); }}><Icon name="trash" size={18}/></button>
        </div>)}</div>{errors.expectedMaterials && <p className="field-error">{serviceErrorText(d, errors.expectedMaterials)}</p>}
        <button type="button" className="button secondary" disabled={draft.expectedMaterials.length >= MAX_MATERIALS} onClick={() => { change("expectedMaterials", [...draft.expectedMaterials, { key: nextKey, name: "", quantity: "", unit: "ml" }]); setNextKey(nextKey + 1); requestAnimationFrame(() => document.getElementById(`material-${draft.expectedMaterials.length}-name`)?.focus()); }}><Icon name="plus" size={16}/>{d.services.addMaterial}</button>
      </section>
    </fieldset>{Object.values(errors).some(Boolean) && <div id="service-errors" tabIndex={-1} className="notice error-notice" role="alert">{errors.form ? serviceErrorText(d, errors.form) : d.services.validationTitle}</div>}{errors.form === "serviceConflict" && <button type="button" className="button secondary" onClick={() => { if (window.confirm(d.services.leave)) window.location.reload(); }}>{d.services.reload}</button>}
      <div className="customer-form-actions"><Link href={cancelPath} className="button secondary" aria-disabled={saving} onClick={confirmLeave}>{d.services.cancel}</Link><button className="button primary" type="submit" disabled={saving || saved}>{saving ? d.services.saving : d.services.save}<Icon name="check" size={17}/></button></div>
    </form>
  </div>;
}
