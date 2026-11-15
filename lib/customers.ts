export type CustomerInput = { fullName: string; phoneNumber: string; email: string | null; notes: string };
export type Customer = CustomerInput & { id: string; createdDate: string; updatedAt: string; version: number };
export type CustomerField = keyof CustomerInput;
export type CustomerErrors = Partial<Record<CustomerField | "form", string>>;
export type CustomerSort = "name_asc" | "name_desc" | "created_desc";
export type CustomerQuery = { query: string; sort: CustomerSort; page: number; pageSize: number };
export type CustomerListResult = CustomerQuery & { items: Customer[]; total: number; totalPages: number };
export type CustomerVehicle = { id: string; manufacturer: string; model: string; productionYear: number | null; registrationNumber: string | null; color: string };
export type CustomerDetailResult = { customer: Customer; vehicles: CustomerVehicle[] };
export const customerFields = ["fullName", "phoneNumber", "email", "notes"] as const;
export const emptyCustomer: CustomerInput = { fullName: "", phoneNumber: "", email: null, notes: "" };

export function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function isUuid(value: string) { return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value); }
export function isVersion(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value < Number.MAX_SAFE_INTEGER; }

export function validateCustomer(input: unknown, editing = false): { success: true; data: CustomerInput; version?: number } | { success: false; errors: CustomerErrors } {
  if (!isRecord(input)) return { success: false, errors: { form: "invalidInput" } };
  const allowed: string[] = [...customerFields, ...(editing ? ["version"] : [])];
  const errors: CustomerErrors = {};
  if (Object.keys(input).some(key => !allowed.includes(key))) errors.form = "invalidInput";
  const fullName = typeof input.fullName === "string" ? input.fullName.trim().normalize("NFC") : "";
  const phoneNumber = typeof input.phoneNumber === "string" ? input.phoneNumber.trim() : "";
  const email = input.email === undefined || input.email === null || (typeof input.email === "string" && !input.email.trim()) ? null : typeof input.email === "string" ? input.email.trim() : undefined;
  const notes = input.notes === undefined ? "" : input.notes;
  if (!fullName) errors.fullName = "nameRequired";
  else if (fullName.length > 160 || /[\u0000-\u001f\u007f]/u.test(fullName)) errors.fullName = "invalidName";
  if (!phoneNumber) errors.phoneNumber = "phoneRequired";
  else if (phoneNumber.length > 40 || !/^\+?[\d\s()./-]+$/u.test(phoneNumber) || /[\u0000-\u001f\u007f]/u.test(phoneNumber) || phoneNumber.replace(/\D/g, "").length < 6 || phoneNumber.replace(/\D/g, "").length > 20) errors.phoneNumber = "invalidPhone";
  if (email === undefined || (email !== null && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)))) errors.email = "invalidEmail";
  if (typeof notes !== "string" || notes.length > 10_000 || notes.includes("\0")) errors.notes = "invalidNotes";
  if (editing && !isVersion(input.version)) errors.form = "invalidVersion";
  if (Object.keys(errors).length) return { success: false, errors };
  return { success: true, data: { fullName, phoneNumber, email: email!, notes: (notes as string).trim() }, ...(editing ? { version: input.version as number } : {}) };
}

// Hungarian accent folding is shared by query normalization and the SQLite
// expression. Parameters remain bound; sort expressions come from an allowlist.
export const accentPairs = [["Á", "a"], ["á", "a"], ["É", "e"], ["é", "e"], ["Í", "i"], ["í", "i"], ["Ó", "o"], ["ó", "o"], ["Ö", "o"], ["ö", "o"], ["Ő", "o"], ["ő", "o"], ["Ú", "u"], ["ú", "u"], ["Ü", "u"], ["ü", "u"], ["Ű", "u"], ["ű", "u"]] as const;
export function normalizeSearch(value: string) { let folded = value.normalize("NFC"); for (const [letter, base] of accentPairs) folded = folded.replaceAll(letter, base); return folded.toLowerCase(); }
export function escapeLike(value: string) { return value.replace(/[\\%_]/g, "\\$&"); }

export function parseCustomerQuery(params: URLSearchParams): CustomerQuery | null {
  const query = (params.get("q") ?? "").trim();
  const sort = params.get("sort") ?? "name_asc";
  const pageText = params.get("page") ?? "1";
  const sizeText = params.get("pageSize") ?? "20";
  if (query.length > 200 || query.split(/\s+/u).filter(Boolean).length > 8 || /[\u0000-\u001f\u007f]/u.test(query)) return null;
  if (!["name_asc", "name_desc", "created_desc"].includes(sort) || !/^\d+$/u.test(pageText) || !/^\d+$/u.test(sizeText)) return null;
  const page = Number(pageText); const pageSize = Number(sizeText);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return null;
  return { query, sort: sort as CustomerSort, page, pageSize };
}

export function customerListPath(query: Pick<CustomerQuery, "query" | "sort" | "page"> & { pageSize?: number }): string {
  const params = new URLSearchParams();
  if (query.query) params.set("q", query.query);
  if (query.sort !== "name_asc") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== undefined && query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  const suffix = params.toString();
  return `/customers${suffix ? `?${suffix}` : ""}`;
}

export function isCustomer(value: unknown): value is Customer {
  return isRecord(value) && typeof value.id === "string" && isUuid(value.id) && typeof value.fullName === "string" && typeof value.phoneNumber === "string" && (value.email === null || typeof value.email === "string") && typeof value.notes === "string" && typeof value.createdDate === "string" && Number.isFinite(Date.parse(value.createdDate)) && typeof value.updatedAt === "string" && isVersion(value.version);
}
