import { isRecord, isUuid, isVersion } from "./customers.ts";
export const MAX_SERVICE_PRICE = 100_000_000;
export const MAX_SERVICE_DURATION = 10_080;
export const MAX_MATERIALS = 50;
export const materialUnits = ["ml", "l", "g", "kg", "piece"] as const;
export type MaterialUnit = (typeof materialUnits)[number];
export type ExpectedMaterial = { name: string; quantity: number | null; unit: MaterialUnit };
export type ServiceInput = { serviceName: string; description: string; defaultPrice: number; expectedDuration: number | null; expectedMaterials: ExpectedMaterial[]; optionalCostEstimate: number | null; active?: boolean };
export type Service = Omit<ServiceInput, "defaultPrice" | "active"> & { id: string; defaultPrice: number | null; active: boolean; currency: "HUF"; serviceType: "single" | "bundle"; createdAt: string; updatedAt: string; version: number };
export type ServiceField = keyof ServiceInput;
export type ServiceErrors = Partial<Record<ServiceField | "form", string>>;
export type MaterialErrors = Record<number, Partial<Record<keyof ExpectedMaterial, string>>>;
export type ServiceSort = "name_asc" | "price_asc" | "price_desc" | "duration_asc" | "created_desc";
export type ServiceQuery = { query: string; status: "all" | "active" | "inactive"; minPrice: number | null; maxPrice: number | null; maxDuration: number | null; sort: ServiceSort; page: number; pageSize: number };
export type ServiceListResult = ServiceQuery & { items: Service[]; total: number; totalPages: number };
export type ServiceBundleComponent = { id: string; serviceId: string; serviceName: string; quantity: number };
export type ServiceDetailResult = { service: Service; bundleComponents: ServiceBundleComponent[] };
export const serviceFields = ["serviceName", "description", "defaultPrice", "expectedDuration", "expectedMaterials", "optionalCostEstimate", "active"] as const;
export const emptyService = { serviceName: "", description: "", expectedDuration: null, expectedMaterials: [] as ExpectedMaterial[], optionalCostEstimate: null, active: true };
const controls = /[\u0000-\u001f\u007f]/u;
export function isHufAmount(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SERVICE_PRICE; }
function isQuantity(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000 && Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7; }
export function isExpectedMaterial(value: unknown): value is ExpectedMaterial { return isRecord(value) && typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 120 && !controls.test(value.name) && (value.quantity === null || isQuantity(value.quantity)) && materialUnits.includes(value.unit as MaterialUnit); }
export function validateService(input: unknown, editing = false): { success: true; data: ServiceInput; version?: number } | { success: false; errors: ServiceErrors; materialErrors: MaterialErrors } {
  const errors: ServiceErrors = {}; const materialErrors: MaterialErrors = {};
  if (!isRecord(input)) return { success: false, errors: { form: "invalidInput" }, materialErrors };
  const allowed: string[] = [...serviceFields, ...(editing ? ["version"] : [])];
  if (Object.keys(input).some(key => !allowed.includes(key))) errors.form = "invalidInput";
  const serviceName = typeof input.serviceName === "string" ? input.serviceName.trim().normalize("NFC") : "";
  const description = input.description === undefined ? "" : input.description;
  const expectedDuration = input.expectedDuration === undefined ? null : input.expectedDuration;
  const optionalCostEstimate = input.optionalCostEstimate === undefined ? null : input.optionalCostEstimate;
  const active = input.active === undefined ? (editing ? undefined : true) : input.active;
  if (!serviceName) errors.serviceName = "nameRequired";
  else if (serviceName.length > 160 || controls.test(serviceName)) errors.serviceName = "invalidName";
  if (typeof description !== "string" || description.length > 10_000 || description.includes("\0")) errors.description = "invalidDescription";
  if (input.defaultPrice === null || input.defaultPrice === undefined || input.defaultPrice === "") errors.defaultPrice = "priceRequired";
  else if (!isHufAmount(input.defaultPrice)) errors.defaultPrice = "invalidPrice";
  if (expectedDuration !== null && (typeof expectedDuration !== "number" || !Number.isInteger(expectedDuration) || expectedDuration < 1 || expectedDuration > MAX_SERVICE_DURATION)) errors.expectedDuration = "invalidDuration";
  if (optionalCostEstimate !== null && !isHufAmount(optionalCostEstimate)) errors.optionalCostEstimate = "invalidCost";
  if (active !== undefined && typeof active !== "boolean") errors.active = "invalidStatus";
  const materials: ExpectedMaterial[] = [];
  const rawMaterials = input.expectedMaterials === undefined ? [] : input.expectedMaterials;
  if (!Array.isArray(rawMaterials) || rawMaterials.length > MAX_MATERIALS) errors.expectedMaterials = "invalidMaterials";
  else rawMaterials.forEach((value: unknown, index: number) => {
    if (!isRecord(value)) { materialErrors[index] = { name: "materialNameRequired" }; return; }
    const rowErrors: MaterialErrors[number] = {};
    if (Object.keys(value).some(key => !["name", "quantity", "unit"].includes(key))) rowErrors.name = "invalidMaterial";
    const name = typeof value.name === "string" ? value.name.trim().normalize("NFC") : "";
    const quantity = value.quantity === undefined ? null : value.quantity;
    if (!name) rowErrors.name = "materialNameRequired";
    else if (name.length > 120 || controls.test(name)) rowErrors.name = "invalidMaterial";
    if (quantity !== null && !isQuantity(quantity)) rowErrors.quantity = "invalidQuantity";
    if (!materialUnits.includes(value.unit as MaterialUnit)) rowErrors.unit = "invalidUnit";
    if (Object.keys(rowErrors).length) materialErrors[index] = rowErrors;
    else materials.push({ name, quantity: quantity as number | null, unit: value.unit as MaterialUnit });
  });
  if (Object.keys(materialErrors).length) errors.expectedMaterials = "invalidMaterials";
  if (editing && !isVersion(input.version)) errors.form = "invalidVersion";
  if (Object.keys(errors).length) return { success: false, errors, materialErrors };
  return { success: true, data: { serviceName, description: (description as string).trim(), defaultPrice: input.defaultPrice as number, expectedDuration: expectedDuration as number | null, expectedMaterials: materials, optionalCostEstimate: optionalCostEstimate as number | null, ...(active === undefined ? {} : { active: active as boolean }) }, ...(editing ? { version: input.version as number } : {}) };
}
export function parseServiceQuery(params: URLSearchParams): ServiceQuery | null {
  const query = (params.get("q") ?? "").trim(); const status = params.get("status") ?? "all"; const sort = params.get("sort") ?? "name_asc";
  const minText = params.get("minPrice") ?? ""; const maxText = params.get("maxPrice") ?? ""; const durationText = params.get("maxDuration") ?? "";
  const pageText = params.get("page") ?? "1"; const sizeText = params.get("pageSize") ?? "20";
  if (query.length > 200 || controls.test(query) || query.split(/\s+/u).filter(Boolean).length > 8 || !["all", "active", "inactive"].includes(status) || !["name_asc", "price_asc", "price_desc", "duration_asc", "created_desc"].includes(sort)) return null;
  for (const text of [minText, maxText]) if (text && (!/^\d+$/u.test(text) || !isHufAmount(Number(text)))) return null;
  const minPrice = minText ? Number(minText) : null; const maxPrice = maxText ? Number(maxText) : null;
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) return null;
  if (durationText && (!/^\d+$/u.test(durationText) || Number(durationText) < 1 || Number(durationText) > MAX_SERVICE_DURATION)) return null;
  if (!/^\d+$/u.test(pageText) || !/^\d+$/u.test(sizeText)) return null;
  const page = Number(pageText); const pageSize = Number(sizeText);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return null;
  return { query, status: status as ServiceQuery["status"], minPrice, maxPrice, maxDuration: durationText ? Number(durationText) : null, sort: sort as ServiceSort, page, pageSize };
}
export function serviceListPath(query: ServiceQuery): string {
  const params = new URLSearchParams();
  if (query.query) params.set("q", query.query);
  if (query.status !== "all") params.set("status", query.status);
  if (query.minPrice !== null) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== null) params.set("maxPrice", String(query.maxPrice));
  if (query.maxDuration !== null) params.set("maxDuration", String(query.maxDuration));
  if (query.sort !== "name_asc") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  return `/services${params.size ? `?${params}` : ""}`;
}
export function formatHuf(value: number, locale: "hu" | "en"): string { return new Intl.NumberFormat(locale === "hu" ? "hu-HU" : "en-GB", { style: "currency", currency: "HUF", maximumFractionDigits: 0 }).format(value); }
export function isService(value: unknown): value is Service {
  return isRecord(value) && typeof value.id === "string" && isUuid(value.id) && typeof value.serviceName === "string" && typeof value.description === "string" && (value.defaultPrice === null || isHufAmount(value.defaultPrice)) && (value.expectedDuration === null || (typeof value.expectedDuration === "number" && Number.isInteger(value.expectedDuration) && value.expectedDuration >= 0)) && Array.isArray(value.expectedMaterials) && value.expectedMaterials.every(isExpectedMaterial) && (value.optionalCostEstimate === null || isHufAmount(value.optionalCostEstimate)) && typeof value.active === "boolean" && value.currency === "HUF" && ["single", "bundle"].includes(value.serviceType as string) && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) && typeof value.updatedAt === "string" && isVersion(value.version);
}
