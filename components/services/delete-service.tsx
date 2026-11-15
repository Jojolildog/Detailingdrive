"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Service } from "../../lib/services.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
import { serviceApiErrors, serviceErrorText } from "./api";

export function DeleteService({ service, locale, compact = false }: { service: Service; locale: Locale; compact?: boolean }) {
  const d = getDictionary(locale); const router = useRouter(); const dialog = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [deleting, setDeleting] = useState(false); const [error, setError] = useState(""); const titleId = `delete-service-${service.id}`;
  useEffect(() => { if (open && !dialog.current?.open) { dialog.current?.showModal(); cancel.current?.focus(); } if (!open && dialog.current?.open) dialog.current.close(); }, [open]);
  async function remove() {
    if (deleting) return; setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/services/${service.id}`, { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: service.version }) });
      if (response.status !== 204) { const payload: unknown = await response.json(); setError(serviceApiErrors(payload).errors.form ?? "unexpected"); return; }
      setOpen(false); router.replace("/services"); router.refresh();
    } catch { setError("unexpected"); } finally { setDeleting(false); }
  }
  return <><button type="button" className={compact ? "icon-button customer-delete" : "button danger-outline"} title={`${d.services.delete}: ${service.serviceName}`} aria-label={`${d.services.delete}: ${service.serviceName}`} onClick={() => { setError(""); setOpen(true); }}><Icon name="trash" size={17}/>{!compact && d.services.delete}</button>
    <dialog ref={dialog} className="customer-delete-dialog" aria-labelledby={titleId} aria-describedby={`${titleId}-description`} onClose={() => setOpen(false)} onCancel={event => { if (deleting) event.preventDefault(); else setOpen(false); }}>
      <span className="delete-dialog-icon"><Icon name="trash" size={25}/></span><h2 id={titleId}>{d.services.deleteTitle}</h2><strong className="delete-customer-name">{service.serviceName}</strong><p id={`${titleId}-description`}>{d.services.deleteDescription}</p><p className="field-hint">{d.services.deleteProtection}</p>
      {error && <div className="notice error-notice" role="alert">{serviceErrorText(d, error)}</div>}<div className="delete-dialog-actions"><button ref={cancel} className="button secondary" disabled={deleting} onClick={() => setOpen(false)}>{d.services.cancel}</button><button className="button danger" disabled={deleting} onClick={remove}>{deleting ? d.services.deleting : d.services.deleteConfirm}</button></div>
    </dialog></>;
}
