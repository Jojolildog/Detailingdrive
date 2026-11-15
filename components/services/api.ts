import { isRecord } from "../../lib/customers.ts";
import { serviceFields, MAX_MATERIALS } from "../../lib/services.ts";
import type { ServiceErrors, MaterialErrors } from "../../lib/services.ts";
import type { Dictionary } from "../../lib/i18n";

export function serviceErrorText(d: Dictionary, code?: string) {
  return code ? d.serviceErrors[code as keyof typeof d.serviceErrors] ?? d.serviceErrors.unexpected : "";
}
export function serviceApiErrors(payload: unknown): { errors: ServiceErrors; materialErrors: MaterialErrors } {
  if (!isRecord(payload)) return { errors: { form: "unexpected" }, materialErrors: {} };
  const errors: ServiceErrors = {}; const materialErrors: MaterialErrors = {};
  if (isRecord(payload.fields)) for (const key of [...serviceFields, "form"] as const) {
    if (typeof payload.fields[key] === "string") errors[key] = payload.fields[key];
  }
  if (isRecord(payload.materials)) for (const [index, row] of Object.entries(payload.materials)) {
    if (!/^\d+$/u.test(index) || Number(index) >= MAX_MATERIALS || !isRecord(row)) continue;
    const entry: MaterialErrors[number] = {};
    for (const key of ["name", "quantity", "unit"] as const) if (typeof row[key] === "string") entry[key] = row[key];
    if (Object.keys(entry).length) materialErrors[Number(index)] = entry;
  }
  errors.form ??= typeof payload.error === "string" ? payload.error : "unexpected";
  return { errors, materialErrors };
}
