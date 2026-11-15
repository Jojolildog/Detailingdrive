import { isRecord, isUuid, isVersion } from "./customers.ts";

export const vehicleSizes = ["small", "medium", "large", "extra_large"] as const;
export type VehicleSize = (typeof vehicleSizes)[number];
export type VehicleInput = {
  customerId: string; manufacturer: string; model: string; productionYear: number | null;
  registrationNumber: string | null; color: string; sizeCategory: VehicleSize; notes: string;
};
export type Vehicle = VehicleInput & { id: string; createdAt: string; updatedAt: string; version: number };
export type VehicleField = keyof VehicleInput;
export type VehicleErrors = Partial<Record<VehicleField | "form", string>>;
export type VehicleOwner = { id: string; fullName: string; phoneNumber: string; email: string | null };
export type VehicleListItem = Vehicle & { customer: VehicleOwner };
export type VehicleSort = "vehicle_asc" | "created_desc" | "year_desc";
export type VehicleQuery = { query: string; customerId: string; manufacturer: string; sizeCategory: VehicleSize | ""; productionYear: number | null; sort: VehicleSort; page: number; pageSize: number };
export type VehicleListResult = VehicleQuery & { items: VehicleListItem[]; total: number; totalPages: number };
export type VehicleServiceEntry = { id: string; status: "scheduled" | "in_progress" | "completed" | "cancelled"; date: string; services: string[] };
export type VehicleServiceHistory = { items: VehicleServiceEntry[]; total: number; page: number; pageSize: number; totalPages: number };
export type VehicleDetailResult = { vehicle: Vehicle; customer: VehicleOwner; serviceHistory: VehicleServiceHistory };
export const vehicleFields = ["customerId", "manufacturer", "model", "productionYear", "registrationNumber", "color", "sizeCategory", "notes"] as const;
export const emptyVehicle: VehicleInput = { customerId: "", manufacturer: "", model: "", productionYear: null, registrationNumber: null, color: "", sizeCategory: "medium", notes: "" };
export function modelYearLimit() { return new Date().getUTCFullYear() + 1; }
const controls = /[\u0000-\u001f\u007f]/u;
function shortText(value: unknown, optional = false): string | undefined {
  if (optional && (value === null || value === undefined)) return "";
  return typeof value === "string" ? value.trim().normalize("NFC") : undefined;
}
export function validateVehicle(input: unknown, editing = false): { success: true; data: VehicleInput; version?: number } | { success: false; errors: VehicleErrors } {
  if (!isRecord(input)) return { success: false, errors: { form: "invalidInput" } };
  const allowed: string[] = [...vehicleFields, ...(editing ? ["version"] : [])];
  const errors: VehicleErrors = {};
  if (Object.keys(input).some(key => !allowed.includes(key))) errors.form = "invalidInput";
  const customerId = typeof input.customerId === "string" ? input.customerId.trim() : "";
  const manufacturer = shortText(input.manufacturer); const model = shortText(input.model);
  const productionYear = input.productionYear === undefined ? null : input.productionYear;
  const registration = shortText(input.registrationNumber, true);
  const registrationNumber = registration ? registration.toLocaleUpperCase("hu-HU").replace(/\s+/gu, " ") : null;
  const color = shortText(input.color, true); const notes = input.notes === undefined ? "" : input.notes;
  if (!customerId || !isUuid(customerId)) errors.customerId = "customerRequired";
  if (!manufacturer) errors.manufacturer = "manufacturerRequired";
  else if (manufacturer.length > 100 || controls.test(manufacturer)) errors.manufacturer = "invalidManufacturer";
  if (!model) errors.model = "modelRequired";
  else if (model.length > 120 || controls.test(model)) errors.model = "invalidModel";
  if (productionYear !== null && (typeof productionYear !== "number" || !Number.isInteger(productionYear) || productionYear < 1886 || productionYear > modelYearLimit())) errors.productionYear = "invalidYear";
  if (registration === undefined || registration.length > 20 || (registrationNumber?.length ?? 0) > 20 || controls.test(registration)) errors.registrationNumber = "invalidRegistration";
  if (color === undefined || color.length > 80 || controls.test(color)) errors.color = "invalidColor";
  if (!vehicleSizes.includes(input.sizeCategory as VehicleSize)) errors.sizeCategory = "invalidSize";
  if (typeof notes !== "string" || notes.length > 10_000 || notes.includes("\0")) errors.notes = "invalidNotes";
  if (editing && !isVersion(input.version)) errors.form = "invalidVersion";
  if (Object.keys(errors).length) return { success: false, errors };
  return { success: true, data: { customerId, manufacturer: manufacturer!, model: model!, productionYear: productionYear as number | null, registrationNumber, color: color!, sizeCategory: input.sizeCategory as VehicleSize, notes: (notes as string).trim() }, ...(editing ? { version: input.version as number } : {}) };
}
export function parseVehicleQuery(params: URLSearchParams): VehicleQuery | null {
  const query = (params.get("q") ?? "").trim(); const customerId = params.get("customerId") ?? "";
  const manufacturer = (params.get("manufacturer") ?? "").trim().normalize("NFC");
  const sizeCategory = params.get("sizeCategory") ?? ""; const year = params.get("productionYear") ?? "";
  const sort = params.get("sort") ?? "vehicle_asc"; const pageText = params.get("page") ?? "1"; const sizeText = params.get("pageSize") ?? "20";
  if (query.length > 200 || controls.test(query) || query.split(/\s+/u).filter(Boolean).length > 8 || (customerId && !isUuid(customerId))) return null;
  if (manufacturer.length > 100 || controls.test(manufacturer) || (sizeCategory && !vehicleSizes.includes(sizeCategory as VehicleSize))) return null;
  if (year && (!/^\d{4}$/u.test(year) || Number(year) < 1886 || Number(year) > modelYearLimit())) return null;
  if (!["vehicle_asc", "created_desc", "year_desc"].includes(sort) || !/^\d+$/u.test(pageText) || !/^\d+$/u.test(sizeText)) return null;
  const page = Number(pageText); const pageSize = Number(sizeText);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return null;
  return { query, customerId, manufacturer, sizeCategory: sizeCategory as VehicleSize | "", productionYear: year ? Number(year) : null, sort: sort as VehicleSort, page, pageSize };
}
export function vehicleListPath(query: VehicleQuery): string {
  const params = new URLSearchParams();
  if (query.query) params.set("q", query.query);
  if (query.customerId) params.set("customerId", query.customerId);
  if (query.manufacturer) params.set("manufacturer", query.manufacturer);
  if (query.sizeCategory) params.set("sizeCategory", query.sizeCategory);
  if (query.productionYear !== null) params.set("productionYear", String(query.productionYear));
  if (query.sort !== "vehicle_asc") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  return `/vehicles${params.size ? `?${params}` : ""}`;
}
export function parseHistoryPage(params: URLSearchParams): number | null {
  const text = params.get("historyPage") ?? "1"; const value = Number(text);
  return /^\d+$/u.test(text) && Number.isSafeInteger(value) && value >= 1 && value <= 100_000 ? value : null;
}
export function isVehicle(value: unknown): value is Vehicle {
  return isRecord(value) && typeof value.id === "string" && isUuid(value.id) && typeof value.customerId === "string" && isUuid(value.customerId) && typeof value.manufacturer === "string" && typeof value.model === "string" && (value.productionYear === null || (typeof value.productionYear === "number" && Number.isInteger(value.productionYear))) && (value.registrationNumber === null || typeof value.registrationNumber === "string") && typeof value.color === "string" && vehicleSizes.includes(value.sizeCategory as VehicleSize) && typeof value.notes === "string" && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) && typeof value.updatedAt === "string" && isVersion(value.version);
}
