"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Customer, CustomerErrors, CustomerField, CustomerInput } from "../../lib/customers.ts";
import { emptyCustomer, isCustomer, isRecord, validateCustomer } from "../../lib/customers.ts";
import { formatDate, getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { useUnsavedChanges } from "../detailflow/unsaved-changes";
import { Icon } from "../detailflow/icon";
import { customerApiErrors, customerErrorText } from "./api";

export function CustomerForm({ customer, locale }: { customer?: Customer; locale: Locale }) {
  const d = getDictionary(locale);
  const router = useRouter();
  const initial: CustomerInput = customer ? { fullName: customer.fullName, phoneNumber: customer.phoneNumber, email: customer.email, notes: customer.notes } : emptyCustomer;
  const [draft, setDraft] = useState<CustomerInput>(initial);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const setUnsaved = useUnsavedChanges();
  const dirty = !saved && JSON.stringify(draft) !== JSON.stringify(initial);
  const cancelPath = customer ? `/customers/${customer.id}` : "/customers";
  useEffect(() => { setUnsaved(dirty); return () => setUnsaved(false); }, [dirty, setUnsaved]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(field: CustomerField, value: string) { setDraft(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: undefined, form: undefined })); }
  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) { if (dirty && !window.confirm(d.customers.leave)) event.preventDefault(); }
  function report(errors: CustomerErrors) {
    setErrors(errors);
    const field = (["fullName", "phoneNumber", "email", "notes"] as const).find(key => errors[key]);
    if (field) requestAnimationFrame(() => document.getElementById(`customer-${field}`)?.focus());
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateCustomer({ ...draft, ...(customer ? { version: customer.version } : {}) }, Boolean(customer));
    if (!parsed.success) { report(parsed.errors); return; }
    setSaving(true); setErrors({});
    try {
      const response = await fetch(customer ? `/api/customers/${customer.id}` : "/api/customers", {
        method: customer ? "PUT" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, ...(customer ? { version: customer.version } : {}) }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) { report(customerApiErrors(payload)); return; }
      if (!isRecord(payload) || !isCustomer(payload.customer)) throw new Error("Invalid customer response");
      setSaved(true); setUnsaved(false);
      router.replace(`/customers/${payload.customer.id}`); router.refresh();
    } catch { setErrors({ form: "unexpected" }); }
    finally { setSaving(false); }
  }
  const inputFields = [
    { key: "fullName", label: d.customers.name, type: "text", autoComplete: "name", required: true, maxLength: 160 },
    { key: "phoneNumber", label: d.customers.phone, type: "tel", autoComplete: "tel", required: true, maxLength: 40 },
    { key: "email", label: d.customers.email, type: "email", autoComplete: "email", required: false, maxLength: 254 },
  ] as const;
  return <div className="customer-form-wrap">
    <Link href={cancelPath} className="back-link" onClick={confirmLeave}><Icon name="back" size={16}/>{customer ? d.customers.view : d.customers.back}</Link>
    <form onSubmit={submit} noValidate className="customer-form">
      <fieldset disabled={saving} className="settings-fieldset">
        <section className="panel form-section"><div className="section-heading"><span className="section-icon"><Icon name="users"/></span><div><h2>{d.customers.contact}</h2><p>{d.customers.contactDescription}</p></div></div>
          <div className="customer-fields">{inputFields.map(field => <div className={`field customer-field-${field.key}`} key={field.key}>
            <label htmlFor={`customer-${field.key}`}>{field.label}<span className="optional">{field.required ? d.customers.required : d.customers.optional}</span></label>
            <input id={`customer-${field.key}`} name={field.key} type={field.type} autoComplete={field.autoComplete} maxLength={field.maxLength} required={field.required} value={draft[field.key] ?? ""} onChange={event => change(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `${field.key}-error` : field.key === "phoneNumber" ? "phone-hint" : undefined}/>
            {errors[field.key] && <p id={`${field.key}-error`} className="field-error">{customerErrorText(d, errors[field.key])}</p>}
            {field.key === "phoneNumber" && !errors.phoneNumber && <p id="phone-hint" className="field-hint">{d.customers.phoneHint}</p>}
          </div>)}</div>
          <div className="customer-created-info"><Icon name="calendar" size={17}/><span>{customer ? `${d.customers.createdDate}: ${formatDate(new Date(customer.createdDate), locale)}` : d.customers.createdAutomatically}</span></div>
        </section>
        <section className="panel form-section"><div className="field"><label htmlFor="customer-notes">{d.customers.notes}<span className="optional">{d.customers.optional}</span></label><textarea id="customer-notes" name="notes" rows={6} maxLength={10_000} value={draft.notes} onChange={event => change("notes", event.target.value)} aria-invalid={Boolean(errors.notes)} aria-describedby="customer-notes-help"/><p id="customer-notes-help" className={errors.notes ? "field-error" : "field-hint"}>{errors.notes ? customerErrorText(d, errors.notes) : d.customers.notesHint}</p></div></section>
      </fieldset>
      {Object.values(errors).some(Boolean) && <div className="notice error-notice" role="alert">{errors.form ? customerErrorText(d, errors.form) : d.customers.validationTitle}</div>}
      {errors.form === "customerConflict" && <button type="button" className="button secondary" onClick={() => { if (window.confirm(d.customers.leave)) window.location.reload(); }}>{d.customers.reload}</button>}
      <div className="customer-form-actions"><Link className="button secondary" href={cancelPath} onClick={event => { if (saving) event.preventDefault(); else confirmLeave(event); }} aria-disabled={saving}>{d.customers.cancel}</Link><button className="button primary" type="submit" disabled={saving || saved}>{saving ? d.customers.saving : d.customers.save}<Icon name="check" size={17}/></button></div>
    </form>
  </div>;
}
