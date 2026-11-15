import { isRecord } from "../../lib/customers.ts";
import { vehicleFields } from "../../lib/vehicles.ts";
import type { VehicleErrors } from "../../lib/vehicles.ts";
import type { Dictionary } from "../../lib/i18n";
export function vehicleErrorText(d: Dictionary, code?: string) { return code ? d.vehicleErrors[code as keyof typeof d.vehicleErrors] ?? d.customerErrors[code as keyof typeof d.customerErrors] ?? d.vehicleErrors.unexpected : ""; }
export function vehicleApiErrors(payload: unknown): VehicleErrors {
  if (!isRecord(payload)) return { form: "unexpected" };
  const errors: VehicleErrors = {};
  if (isRecord(payload.fields)) for (const key of [...vehicleFields, "form"] as const) if (typeof payload.fields[key] === "string") errors[key] = payload.fields[key];
  errors.form = errors.form ?? (typeof payload.error === "string" ? payload.error : "unexpected");
  if (errors.form === "vehicleCustomerInvalid") errors.customerId = "vehicleCustomerInvalid";
  return errors;
}
