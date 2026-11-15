"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WorkOrder } from "../../lib/work-orders.ts";
import { getDictionary } from "../../lib/i18n";
import type { Locale } from "../../lib/settings.ts";
import { Icon } from "../detailflow/icon";
import { workOrderApiErrors, workOrderErrorText } from "./api";
export function DeleteWorkOrder({ workOrder, locale, compact = false }: { workOrder: WorkOrder; locale: Locale; compact?: boolean }) {
  const d = getDictionary(locale); const router = useRouter(); const dialog = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [deleting, setDeleting] = useState(false); const [error, setError] = useState(""); const titleId = `delete-work-${workOrder.id}`;
  useEffect(() => { if (open && !dialog.current?.open) { dialog.current?.showModal(); cancel.current?.focus(); } if (!open && dialog.current?.open) dialog.current.close(); }, [open]);
  async function remove() {
    if (deleting) return; setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/work-orders/${workOrder.id}`, { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: workOrder.version }) });
      if (response.status !== 204) { const payload: unknown = await response.json(); setError(workOrderApiErrors(payload).form ?? "unexpected"); return; }
      setOpen(false); router.replace("/work-orders"); router.refresh();
    } catch { setError("unexpected"); } finally { setDeleting(false); }
  }
  return <><button type="button" className={compact ? "icon-button customer-delete" : "button danger-outline"} aria-label={`${d.workOrders.delete}: ${workOrder.id}`} title={d.workOrders.delete} onClick={() => { setError(""); setOpen(true); }}><Icon name="trash" size={17}/>{!compact && d.workOrders.delete}</button>
    <dialog ref={dialog} className="customer-delete-dialog" aria-labelledby={titleId} aria-describedby={`${titleId}-description`} onClose={() => setOpen(false)} onCancel={event => { if (deleting) event.preventDefault(); else setOpen(false); }}><span className="delete-dialog-icon"><Icon name="trash" size={25}/></span><h2 id={titleId}>{d.workOrders.deleteTitle}</h2><p id={`${titleId}-description`}>{d.workOrders.deleteDescription}</p><p className="field-hint">{d.workOrders.deleteProtection}</p>{error && <div className="notice error-notice" role="alert">{workOrderErrorText(d, error)}</div>}<div className="delete-dialog-actions"><button ref={cancel} className="button secondary" disabled={deleting} onClick={() => setOpen(false)}>{d.workOrders.cancel}</button><button className="button danger" disabled={deleting} onClick={remove}>{deleting ? d.workOrders.deleting : d.workOrders.deleteConfirm}</button></div></dialog>
  </>;
}
