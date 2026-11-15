import { customerFields, isRecord } from "../../lib/customers.ts";
import type { CustomerErrors } from "../../lib/customers.ts";
import type { Dictionary } from "../../lib/i18n";
export function customerErrorText(dictionary: Dictionary, code?: string): string {
  return code ? dictionary.customerErrors[code as keyof typeof dictionary.customerErrors] ?? dictionary.customerErrors.unexpected : "";
}
export function customerApiErrors(payload: unknown): CustomerErrors {
  if (!isRecord(payload)) return { form: "unexpected" };
  const errors: CustomerErrors = {};
  if (isRecord(payload.fields)) for (const key of [...customerFields, "form"] as const) {
    if (typeof payload.fields[key] === "string") errors[key] = payload.fields[key];
  }
  errors.form = errors.form ?? (typeof payload.error === "string" ? payload.error : "unexpected");
  return errors;
}
