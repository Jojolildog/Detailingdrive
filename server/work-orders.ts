import { escapeLike, isUuid, normalizeSearch } from "../lib/customers.ts";
import { isHufAmount } from "../lib/services.ts";
import type { WorkOrder, WorkOrderInput, WorkOrderService, WorkOrderDetail, WorkOrderQuery, WorkOrderListResult, WorkOrderSummary } from "../lib/work-orders.ts";
import { ApplicationError } from "./errors.ts";
import { getCustomer } from "./customers.ts";
import { getVehicle } from "./vehicles.ts";
import { foldHungarianSql } from "./search.ts";

type OrderRow = { id: string; customer_id: string; vehicle_id: string; scheduled_at: string | null; started_at: string | null; finished_at: string | null; job_status: WorkOrder["jobStatus"]; payment_status: WorkOrder["paymentStatus"]; price_huf: number; notes: string; created_at: string; updated_at: string; version: number };
type LineRow = { id: string; service_id: string | null; name_snapshot: string; price_huf: number; work_order_id: string };
function lineDto(row: LineRow): WorkOrderService { return { id: row.id, serviceId: row.service_id, serviceName: row.name_snapshot, servicePrice: row.price_huf }; }
function dto(row: OrderRow, lines: WorkOrderService[]): WorkOrder { return { id: row.id, customerId: row.customer_id, vehicleId: row.vehicle_id, scheduledDate: row.scheduled_at, startTime: row.started_at, finishTime: row.finished_at, jobStatus: row.job_status, paymentStatus: row.payment_status, servicePrice: row.price_huf, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, version: row.version, selectedServices: lines }; }
async function orderRow(db: D1Database, businessId: string, id: string): Promise<OrderRow> {
  if (!isUuid(id)) throw new ApplicationError(404, "workOrderNotFound");
  const row = await db.prepare("SELECT * FROM work_orders WHERE id = ? AND business_id = ?").bind(id, businessId).first<OrderRow>();
  if (!row) throw new ApplicationError(404, "workOrderNotFound"); return row;
}
async function readLines(db: D1Database, businessId: string, ids: string[]) {
  const lines = new Map<string, WorkOrderService[]>(); if (!ids.length) return lines;
  for (let offset = 0; offset < ids.length; offset += 90) {
    const group = ids.slice(offset, offset + 90);
    const result = await db.prepare(`SELECT * FROM work_order_services WHERE business_id = ? AND work_order_id IN (${group.map(() => "?").join(",")}) ORDER BY created_at, id`).bind(businessId, ...group).all<LineRow>();
    for (const row of result.results) lines.set(row.work_order_id, [...(lines.get(row.work_order_id) ?? []), lineDto(row)]);
  }
  return lines;
}
export async function getWorkOrder(db: D1Database, businessId: string, id: string): Promise<WorkOrder> {
  const row = await orderRow(db, businessId, id); const lines = await readLines(db, businessId, [id]); return dto(row, lines.get(id) ?? []);
}
async function relationship(db: D1Database, businessId: string, customerId: string, vehicleId: string) {
  try {
    const [customer, vehicle] = await Promise.all([getCustomer(db, businessId, customerId), getVehicle(db, businessId, vehicleId)]);
    if (vehicle.customerId !== customer.id) throw new ApplicationError(422, "invalidRelationship");
    return { customer: { id: customer.id, fullName: customer.fullName, phoneNumber: customer.phoneNumber, email: customer.email }, vehicle };
  } catch (error) { if (error instanceof ApplicationError && error.status === 404) throw new ApplicationError(422, "invalidRelationship"); throw error; }
}
export async function getWorkOrderDetail(db: D1Database, businessId: string, id: string): Promise<WorkOrderDetail> {
  const workOrder = await getWorkOrder(db, businessId, id); return { workOrder, ...await relationship(db, businessId, workOrder.customerId, workOrder.vehicleId) };
}
export async function listWorkOrders(db: D1Database, businessId: string, query: WorkOrderQuery): Promise<WorkOrderListResult> {
  const clauses = ["w.business_id = ?"]; const values: (string | number)[] = [businessId];
  for (const [key, column] of [["customerId", "customer_id"], ["vehicleId", "vehicle_id"], ["jobStatus", "job_status"], ["paymentStatus", "payment_status"]] as const) if (query[key]) { clauses.push(`w.${column} = ?`); values.push(query[key]); }
  for (const token of normalizeSearch(query.query).split(/\s+/u).filter(Boolean)) {
    const match = `%${escapeLike(token)}%`;
    clauses.push(`(${foldHungarianSql("c.full_name")} LIKE ? ESCAPE '\\' OR ${foldHungarianSql("v.manufacturer")} LIKE ? ESCAPE '\\' OR ${foldHungarianSql("v.model")} LIKE ? ESCAPE '\\' OR ${foldHungarianSql("v.registration_number")} LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM work_order_services ws WHERE ws.business_id = w.business_id AND ws.work_order_id = w.id AND ${foldHungarianSql("ws.name_snapshot")} LIKE ? ESCAPE '\\'))`);
    values.push(match, match, match, match, match);
  }
  const join = "FROM work_orders w JOIN customers c ON c.id = w.customer_id AND c.business_id = w.business_id JOIN vehicles v ON v.id = w.vehicle_id AND v.customer_id = w.customer_id AND v.business_id = w.business_id";
  const where = clauses.join(" AND "); const count = await db.prepare(`SELECT COUNT(*) AS total ${join} WHERE ${where}`).bind(...values).first<{ total: number }>();
  const total = count?.total ?? 0; const totalPages = Math.max(1, Math.ceil(total / query.pageSize)); const page = Math.min(query.page, totalPages);
  const order = query.sort === "created_desc" ? "w.created_at DESC, w.id ASC" : "w.scheduled_at IS NULL ASC, w.scheduled_at ASC, w.id ASC";
  type Joined = OrderRow & { customer_name: string; customer_phone: string; customer_email: string | null; manufacturer: string; model: string; registration_number: string | null };
  const rows = await db.prepare(`SELECT w.*, c.full_name AS customer_name, c.phone_number AS customer_phone, c.email AS customer_email, v.manufacturer, v.model, v.registration_number ${join} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values, query.pageSize, (page - 1) * query.pageSize).all<Joined>();
  const lines = await readLines(db, businessId, rows.results.map(row => row.id));
  const items: WorkOrderSummary[] = rows.results.map(row => ({ ...dto(row, lines.get(row.id) ?? []), customer: { id: row.customer_id, fullName: row.customer_name, phoneNumber: row.customer_phone, email: row.customer_email }, vehicle: { id: row.vehicle_id, manufacturer: row.manufacturer, model: row.model, registrationNumber: row.registration_number } }));
  return { ...query, total, totalPages, page, items };
}
async function selectedLines(db: D1Database, businessId: string, input: WorkOrderInput, current?: WorkOrder): Promise<WorkOrderService[]> {
  const selected: WorkOrderService[] = [];
  const ids = input.selectedServices.filter(selection => !selection.snapshotId).map(selection => selection.serviceId);
  type CatalogRow = { id: string; name: string; default_price_huf: number | null; active: number };
  const catalog = ids.length ? (await db.prepare(`SELECT id, name, default_price_huf, active FROM services WHERE business_id = ? AND id IN (${ids.map(() => "?").join(",")})`).bind(businessId, ...ids).all<CatalogRow>()).results : [];
  for (const selection of input.selectedServices) {
    if (selection.snapshotId) {
      const existing = current?.selectedServices.find(row => row.id === selection.snapshotId && row.serviceId === selection.serviceId);
      if (!existing) throw new ApplicationError(422, "invalidServices"); selected.push(existing);
    } else {
      const service = catalog.find(row => row.id === selection.serviceId);
      if (!service || !service.active || !isHufAmount(service.default_price_huf)) throw new ApplicationError(422, "serviceUnavailable");
      selected.push({ id: crypto.randomUUID(), serviceId: service.id, serviceName: service.name, servicePrice: service.default_price_huf });
    }
  }
  return selected;
}
function insertLines(db: D1Database, businessId: string, id: string, lines: WorkOrderService[], now: string, token?: string): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  // Ten rows keep each prepared statement below D1's bound-parameter limit.
  for (let offset = 0; offset < lines.length; offset += 10) {
    const group = lines.slice(offset, offset + 10); const values = group.flatMap(line => [line.id, businessId, id, line.serviceId, line.serviceName, line.servicePrice, now, now]);
    const rows = group.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",");
    const source = token ? `SELECT * FROM (VALUES ${rows}) WHERE EXISTS (SELECT 1 FROM work_orders WHERE id = ? AND business_id = ? AND write_token = ?)` : `VALUES ${rows}`;
    statements.push(db.prepare(`INSERT INTO work_order_services (id, business_id, work_order_id, service_id, name_snapshot, price_huf, created_at, updated_at) ${source}`).bind(...values, ...(token ? [id, businessId, token] : [])));
  }
  return statements;
}
function relationError(error: unknown): never { if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new ApplicationError(422, "invalidRelationship"); throw error; }
export async function createWorkOrder(db: D1Database, businessId: string, input: WorkOrderInput): Promise<WorkOrder> {
  await relationship(db, businessId, input.customerId, input.vehicleId); const lines = await selectedLines(db, businessId, input);
  if (input.paymentStatus === "refunded") throw new ApplicationError(422, "invalidPaymentStatus");
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  const statements = [db.prepare("INSERT INTO work_orders (id, business_id, customer_id, vehicle_id, scheduled_at, started_at, finished_at, job_status, payment_status, price_huf, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, businessId, input.customerId, input.vehicleId, input.scheduledDate, input.startTime, input.finishTime, input.jobStatus, input.paymentStatus, input.servicePrice, input.notes, now, now), ...insertLines(db, businessId, id, lines, now)];
  try { await db.batch(statements); } catch (error) { relationError(error); }
  return getWorkOrder(db, businessId, id);
}
export async function updateWorkOrder(db: D1Database, businessId: string, id: string, input: WorkOrderInput, version: number): Promise<WorkOrder> {
  const current = await getWorkOrder(db, businessId, id); if (current.version !== version) throw new ApplicationError(409, "workOrderConflict");
  if (input.paymentStatus === "refunded" && current.paymentStatus !== "refunded") throw new ApplicationError(422, "invalidPaymentStatus");
  await relationship(db, businessId, input.customerId, input.vehicleId); const lines = await selectedLines(db, businessId, input, current);
  const token = crypto.randomUUID(); const now = new Date().toISOString();
  // D1 batch is transactional. The unique write token gates every child mutation,
  // including when another writer wins between the read and conditional UPDATE.
  const guard = "EXISTS (SELECT 1 FROM work_orders WHERE id = ? AND business_id = ? AND write_token = ?)";
  const removed = current.selectedServices.filter(old => !lines.some(line => line.id === old.id)); const added = lines.filter(line => !current.selectedServices.some(old => old.id === line.id));
  const statements = [db.prepare("UPDATE work_orders SET customer_id = ?, vehicle_id = ?, scheduled_at = ?, started_at = ?, finished_at = ?, job_status = ?, payment_status = ?, price_huf = ?, notes = ?, updated_at = ?, version = version + 1, write_token = ? WHERE id = ? AND business_id = ? AND version = ?").bind(input.customerId, input.vehicleId, input.scheduledDate, input.startTime, input.finishTime, input.jobStatus, input.paymentStatus, input.servicePrice, input.notes, now, token, id, businessId, version),
    ...(removed.length ? [db.prepare(`DELETE FROM work_order_services WHERE id IN (${removed.map(() => "?").join(",")}) AND business_id = ? AND work_order_id = ? AND ${guard}`).bind(...removed.map(line => line.id), businessId, id, id, businessId, token)] : []),
    ...insertLines(db, businessId, id, added, now, token)];
  try { const result = await db.batch(statements); if (result[0].meta.changes !== 1) throw new ApplicationError(409, "workOrderConflict"); } catch (error) { relationError(error); }
  return getWorkOrder(db, businessId, id);
}
export async function deleteWorkOrder(db: D1Database, businessId: string, id: string, version: number): Promise<void> {
  const current = await orderRow(db, businessId, id); if (current.version !== version) throw new ApplicationError(409, "workOrderConflict");
  try {
    const result = await db.batch([
      db.prepare("DELETE FROM work_order_services WHERE work_order_id = ? AND business_id = ? AND EXISTS (SELECT 1 FROM work_orders WHERE id = ? AND business_id = ? AND version = ?)").bind(id, businessId, id, businessId, version),
      db.prepare("DELETE FROM work_orders WHERE id = ? AND business_id = ? AND version = ?").bind(id, businessId, version),
    ]);
    if (result[1].meta.changes !== 1) throw new ApplicationError(409, "workOrderConflict");
  } catch (error) { if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new ApplicationError(409, "workOrderHasRecords"); throw error; }
}
