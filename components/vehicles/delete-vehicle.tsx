"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Vehicle } from "../../lib/vehicles.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
import { vehicleApiErrors, vehicleErrorText } from "./api";
export function DeleteVehicle({ vehicle, locale, compact = false }: { vehicle: Vehicle; locale: Locale; compact?: boolean }) {
  const d = getDictionary(locale); const router = useRouter(); const dialog = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [deleting, setDeleting] = useState(false); const [error, setError] = useState(""); const titleId = `delete-vehicle-${vehicle.id}`;
  useEffect(() => { if (open && !dialog.current?.open) { dialog.current?.showModal(); cancel.current?.focus(); } if (!open && dialog.current?.open) dialog.current.close(); }, [open]);
  async function remove() {
    if (deleting) return; setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: vehicle.version }) });
      if (response.status !== 204) { const payload: unknown = await response.json(); setError(vehicleApiErrors(payload).form ?? "unexpected"); return; }
      setOpen(false); router.replace("/vehicles"); router.refresh();
    } catch { setError("unexpected"); } finally { setDeleting(false); }
  }
  return <><button type="button" className={compact ? "icon-button customer-delete" : "button danger-outline"} title={`${d.vehicles.delete}: ${vehicle.manufacturer} ${vehicle.model}`} aria-label={`${d.vehicles.delete}: ${vehicle.manufacturer} ${vehicle.model}`} onClick={() => { setError(""); setOpen(true); }}><Icon name="trash" size={17}/>{!compact && d.vehicles.delete}</button>
    <dialog ref={dialog} className="customer-delete-dialog" aria-labelledby={titleId} aria-describedby={`${titleId}-description`} onClose={() => setOpen(false)} onCancel={event => { if (deleting) event.preventDefault(); else setOpen(false); }}>
      <span className="delete-dialog-icon"><Icon name="trash" size={25}/></span><h2 id={titleId}>{d.vehicles.deleteTitle}</h2><strong className="delete-customer-name">{vehicle.manufacturer} {vehicle.model}{vehicle.registrationNumber && ` · ${vehicle.registrationNumber}`}</strong><p id={`${titleId}-description`}>{d.vehicles.deleteDescription}</p><p className="field-hint">{d.vehicles.deleteProtection}</p>
      {error && <div className="notice error-notice" role="alert">{vehicleErrorText(d, error)}</div>}<div className="delete-dialog-actions"><button ref={cancel} className="button secondary" disabled={deleting} onClick={() => setOpen(false)}>{d.vehicles.cancel}</button><button className="button danger" disabled={deleting} onClick={remove}>{deleting ? d.vehicles.deleting : d.vehicles.deleteConfirm}</button></div>
    </dialog></>;
}
