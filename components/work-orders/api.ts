import { isRecord } from "../../lib/customers.ts";
import { workOrderFields } from "../../lib/work-orders.ts";
import type { WorkOrderErrors } from "../../lib/work-orders.ts";
import type { Dictionary } from "../../lib/i18n";
export function workOrderErrorText(d: Dictionary, code?: string) { return code ? d.workOrderErrors[code as keyof typeof d.workOrderErrors] ?? d.workOrderErrors.unexpected : ""; }
export function workOrderApiErrors(payload: unknown): WorkOrderErrors {
  if (!isRecord(payload)) return { form: "unexpected" }; const errors: WorkOrderErrors = {};
  if (isRecord(payload.fields)) for (const key of [...workOrderFields, "form"] as const) if (typeof payload.fields[key] === "string") errors[key] = payload.fields[key];
  errors.form ??= typeof payload.error === "string" ? payload.error : "unexpected";
  if (errors.form === "invalidRelationship") errors.vehicleId = "invalidRelationship";
  if (["invalidServices", "serviceUnavailable"].includes(errors.form)) errors.selectedServices = errors.form;
  return errors;
}
