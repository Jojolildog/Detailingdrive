import { isRecord, isUuid, isVersion } from "./customers.ts";
import { isHufAmount } from "./services.ts";
import type { Vehicle, VehicleOwner } from "./vehicles.ts";

export const jobStatuses = ["scheduled", "in_progress", "completed", "cancelled"] as const;
export const paymentStatuses = ["unpaid", "partial", "paid"] as const;
export type JobStatus = (typeof jobStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type ServiceSelection = { serviceId: string | null; snapshotId?: string };
export type WorkOrderService = { id: string; serviceId: string | null; serviceName: string; servicePrice: number };
export type WorkOrderInput = { customerId: string; vehicleId: string; selectedServices: ServiceSelection[]; scheduledDate: string | null; startTime: string | null; finishTime: string | null; jobStatus: JobStatus; paymentStatus: PaymentStatus | "refunded"; servicePrice: number; notes: string };
export type WorkOrder = Omit<WorkOrderInput, "selectedServices"> & { id: string; selectedServices: WorkOrderService[]; createdAt: string; updatedAt: string; version: number };
export type WorkOrderDetail = { workOrder: WorkOrder; customer: VehicleOwner; vehicle: Vehicle };
export type WorkOrderSummary = WorkOrder & { customer: VehicleOwner; vehicle: Pick<Vehicle, "id" | "manufacturer" | "model" | "registrationNumber"> };
export type WorkOrderQuery = { query: string; customerId: string; vehicleId: string; jobStatus: JobStatus | ""; paymentStatus: PaymentStatus | "refunded" | ""; sort: "scheduled_asc" | "created_desc"; page: number; pageSize: number };
export type WorkOrderListResult = WorkOrderQuery & { items: WorkOrderSummary[]; total: number; totalPages: number };
export type WorkOrderErrors = Partial<Record<keyof WorkOrderInput | "form", string>>;
export const workOrderFields = ["customerId", "vehicleId", "selectedServices", "scheduledDate", "startTime", "finishTime", "jobStatus", "paymentStatus", "servicePrice", "notes"] as const;
export const MAX_SELECTED_SERVICES = 50;

export function timestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second = "0", zone] = match;
  const y = Number(year); const m = Number(month); const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (y < 100 || m < 1 || m > 12 || Number(day) < 1 || Number(day) > days || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return undefined;
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 14 || Number(zone.slice(4)) > 59 || (Number(zone.slice(1, 3)) === 14 && Number(zone.slice(4)) !== 0))) return undefined;
  const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}
export function toBudapestInput(value: string | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}
export function fromBudapestInput(value: string): string | null | undefined {
  if (!value) return null;
  const local = value.length === 16 ? `${value}:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(local) || !timestamp(`${local}Z`)) return undefined;
  // Both Budapest offsets are tried. A spring gap is rejected; in an autumn
  // overlap the first occurrence is chosen. Unchanged stored instants are retained by the form.
  for (const offset of [120, 60]) { const candidate = new Date(Date.parse(`${local}Z`) - offset * 60000).toISOString(); if (toBudapestInput(candidate) === local) return candidate; }
  return undefined;
}
export function formatWorkTime(value: string | null, locale: "hu" | "en"): string | null {
  return value ? new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-GB", { timeZone: "Europe/Budapest", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : null;
}
export function validateWorkOrder(input: unknown, editing = false): { success: true; data: WorkOrderInput; version?: number } | { success: false; errors: WorkOrderErrors } {
  if (!isRecord(input)) return { success: false, errors: { form: "invalidInput" } };
  const errors: WorkOrderErrors = {}; const allowed: string[] = [...workOrderFields, ...(editing ? ["version"] : [])];
  if (Object.keys(input).some(key => !allowed.includes(key))) errors.form = "invalidInput";
  for (const key of ["customerId", "vehicleId"] as const) if (typeof input[key] !== "string" || !isUuid(input[key])) errors[key] = key === "customerId" ? "customerRequired" : "vehicleRequired";
  const selections: ServiceSelection[] = []; const serviceIds = new Set<string>(); const snapshotIds = new Set<string>();
  if (!Array.isArray(input.selectedServices) || input.selectedServices.length < 1 || input.selectedServices.length > MAX_SELECTED_SERVICES) errors.selectedServices = "servicesRequired";
  else for (const entry of input.selectedServices) {
    if (!isRecord(entry) || Object.keys(entry).some(key => !["serviceId", "snapshotId"].includes(key)) || !(typeof entry.serviceId === "string" && isUuid(entry.serviceId) || editing && entry.serviceId === null && typeof entry.snapshotId === "string") || (entry.snapshotId !== undefined && (!editing || typeof entry.snapshotId !== "string" || !isUuid(entry.snapshotId)))) { errors.selectedServices = "invalidServices"; continue; }
    const serviceId = entry.serviceId as string | null; const snapshotId = entry.snapshotId as string | undefined;
    if (serviceId && serviceIds.has(serviceId) || snapshotId && snapshotIds.has(snapshotId)) errors.selectedServices = "invalidServices";
    if (serviceId) serviceIds.add(serviceId); if (snapshotId) snapshotIds.add(snapshotId);
    selections.push({ serviceId, ...(snapshotId ? { snapshotId } : {}) });
  }
  const dates = { scheduledDate: timestamp(input.scheduledDate), startTime: timestamp(input.startTime), finishTime: timestamp(input.finishTime) };
  for (const key of ["scheduledDate", "startTime", "finishTime"] as const) if (dates[key] === undefined) errors[key] = "invalidDate";
  if (dates.finishTime && (!dates.startTime || dates.finishTime < dates.startTime)) errors.finishTime = "invalidTimeRange";
  if (!jobStatuses.includes(input.jobStatus as JobStatus)) errors.jobStatus = "invalidJobStatus";
  if (!paymentStatuses.includes(input.paymentStatus as PaymentStatus) && !(editing && input.paymentStatus === "refunded")) errors.paymentStatus = "invalidPaymentStatus";
  if (input.servicePrice === null || input.servicePrice === undefined || input.servicePrice === "") errors.servicePrice = "priceRequired";
  else if (!isHufAmount(input.servicePrice)) errors.servicePrice = "invalidPrice";
  const notes = input.notes ?? ""; if (typeof notes !== "string" || notes.length > 10000 || notes.includes("\0")) errors.notes = "invalidNotes";
  if (editing && !isVersion(input.version)) errors.form = "invalidVersion";
  if (Object.keys(errors).length) return { success: false, errors };
  return { success: true, data: { customerId: input.customerId as string, vehicleId: input.vehicleId as string, selectedServices: selections, scheduledDate: dates.scheduledDate!, startTime: dates.startTime!, finishTime: dates.finishTime!, jobStatus: input.jobStatus as JobStatus, paymentStatus: input.paymentStatus as WorkOrderInput["paymentStatus"], servicePrice: input.servicePrice as number, notes: (notes as string).trim() }, ...(editing ? { version: input.version as number } : {}) };
}
export function parseWorkOrderQuery(params: URLSearchParams): WorkOrderQuery | null {
  const query = (params.get("q") ?? "").trim(); const customerId = params.get("customerId") ?? ""; const vehicleId = params.get("vehicleId") ?? "";
  const jobStatus = params.get("jobStatus") ?? ""; const paymentStatus = params.get("paymentStatus") ?? ""; const sort = params.get("sort") ?? "scheduled_asc";
  const p = params.get("page") ?? "1"; const size = params.get("pageSize") ?? "20";
  if (query.length > 200 || /[\u0000-\u001f\u007f]/u.test(query) || query.split(/\s+/u).filter(Boolean).length > 8 || customerId && !isUuid(customerId) || vehicleId && !isUuid(vehicleId)) return null;
  if (jobStatus && !jobStatuses.includes(jobStatus as JobStatus) || paymentStatus && ![...paymentStatuses, "refunded"].includes(paymentStatus) || !["scheduled_asc", "created_desc"].includes(sort)) return null;
  if (!/^\d+$/u.test(p) || !/^\d+$/u.test(size) || Number(p) < 1 || Number(p) > 100000 || Number(size) < 1 || Number(size) > 100) return null;
  return { query, customerId, vehicleId, jobStatus: jobStatus as WorkOrderQuery["jobStatus"], paymentStatus: paymentStatus as WorkOrderQuery["paymentStatus"], sort: sort as WorkOrderQuery["sort"], page: Number(p), pageSize: Number(size) };
}
export function workOrderListPath(query: WorkOrderQuery): string {
  const p = new URLSearchParams(); if (query.query) p.set("q", query.query);
  for (const key of ["customerId", "vehicleId", "jobStatus", "paymentStatus"] as const) if (query[key]) p.set(key, query[key]);
  if (query.sort !== "scheduled_asc") p.set("sort", query.sort); if (query.page > 1) p.set("page", String(query.page)); if (query.pageSize !== 20) p.set("pageSize", String(query.pageSize));
  return `/work-orders${p.size ? `?${p}` : ""}`;
}
export function isWorkOrder(value: unknown): value is WorkOrder {
  return isRecord(value) && typeof value.id === "string" && isUuid(value.id) && typeof value.customerId === "string" && isUuid(value.customerId) && typeof value.vehicleId === "string" && isUuid(value.vehicleId) && Array.isArray(value.selectedServices) && value.selectedServices.every(row => isRecord(row) && typeof row.id === "string" && isUuid(row.id) && (row.serviceId === null || typeof row.serviceId === "string" && isUuid(row.serviceId)) && typeof row.serviceName === "string" && typeof row.servicePrice === "number" && Number.isSafeInteger(row.servicePrice) && row.servicePrice >= 0) && ["scheduledDate", "startTime", "finishTime"].every(key => value[key] === null || typeof value[key] === "string" && Number.isFinite(Date.parse(value[key] as string))) && jobStatuses.includes(value.jobStatus as JobStatus) && [...paymentStatuses, "refunded"].includes(value.paymentStatus as PaymentStatus) && typeof value.servicePrice === "number" && Number.isSafeInteger(value.servicePrice) && value.servicePrice >= 0 && typeof value.notes === "string" && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) && typeof value.updatedAt === "string" && isVersion(value.version);
}
