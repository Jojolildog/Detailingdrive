"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Customer } from "../../lib/customers.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
import { customerApiErrors, customerErrorText } from "./api";

export function DeleteCustomer({ customer, locale, compact = false }: { customer: Customer; locale: Locale; compact?: boolean }) {
  const d = getDictionary(locale); const router = useRouter();
  const [open, setOpen] = useState(false); const [deleting, setDeleting] = useState(false); const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null); const cancelButton = useRef<HTMLButtonElement>(null);
  const headingId = `delete-customer-${customer.id}`;
  useEffect(() => {
    if (open && !dialog.current?.open) { dialog.current?.showModal(); cancelButton.current?.focus(); }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  async function remove() {
    if (deleting) return;
    setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: customer.version }) });
      if (response.status !== 204) { const payload: unknown = await response.json(); setError(customerApiErrors(payload).form ?? "unexpected"); return; }
      setOpen(false); router.replace("/customers"); router.refresh();
    } catch { setError("unexpected"); }
    finally { setDeleting(false); }
  }
  return <>
    <button type="button" className={compact ? "icon-button customer-delete" : "button danger-outline"} title={`${d.customers.delete}: ${customer.fullName}`} aria-label={`${d.customers.delete}: ${customer.fullName}`} onClick={() => { setError(""); setOpen(true); }}><Icon name="trash" size={17}/>{!compact && d.customers.delete}</button>
    <dialog ref={dialog} className="customer-delete-dialog" aria-labelledby={headingId} aria-describedby={`${headingId}-description`} onClose={() => setOpen(false)} onCancel={event => { if (deleting) event.preventDefault(); else setOpen(false); }}>
      <span className="delete-dialog-icon"><Icon name="trash" size={25}/></span><h2 id={headingId}>{d.customers.deleteTitle}</h2><strong className="delete-customer-name">{customer.fullName}</strong><p id={`${headingId}-description`}>{d.customers.deleteDescription}</p><p className="field-hint">{d.customers.deleteProtection}</p>
      {error && <div className="notice error-notice" role="alert">{customerErrorText(d, error)}</div>}
      <div className="delete-dialog-actions"><button ref={cancelButton} className="button secondary" disabled={deleting} onClick={() => setOpen(false)}>{d.customers.cancel}</button><button className="button danger" disabled={deleting} onClick={remove}>{deleting ? d.customers.deleting : d.customers.deleteConfirm}</button></div>
    </dialog>
  </>;
}
