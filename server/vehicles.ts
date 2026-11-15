import { escapeLike, isUuid, normalizeSearch } from "../lib/customers.ts";
import type { Vehicle, VehicleInput, VehicleOwner, VehicleListResult, VehicleQuery, VehicleDetailResult, VehicleServiceEntry } from "../lib/vehicles.ts";
import { ApplicationError } from "./errors.ts";
import { getCustomer } from "./customers.ts";
import { foldHungarianSql } from "./search.ts";
type VehicleRow = { id: string; customer_id: string; manufacturer: string; model: string; production_year: number | null; registration_number: string | null; color: string; size_category: Vehicle["sizeCategory"]; notes: string; created_at: string; updated_at: string; version: number };
type JoinedRow = VehicleRow & { customer_name: string; customer_phone: string; customer_email: string | null };
function dto(row: VehicleRow): Vehicle { return { id: row.id, customerId: row.customer_id, manufacturer: row.manufacturer, model: row.model, productionYear: row.production_year, registrationNumber: row.registration_number, color: row.color, sizeCategory: row.size_category, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, version: row.version }; }
const manufacturerSql = foldHungarianSql("v.manufacturer"); const modelSql = foldHungarianSql("v.model");
const plateSql = foldHungarianSql("v.registration_number");
const compactPlateSql = `REPLACE(REPLACE(REPLACE(${plateSql}, '-', ''), ' ', ''), '.', '')`;
const joinSql = "FROM vehicles v JOIN customers c ON c.id = v.customer_id AND c.business_id = v.business_id";
async function requireCustomer(db: D1Database, businessId: string, customerId: string): Promise<VehicleOwner> {
  try { const customer = await getCustomer(db, businessId, customerId); return { id: customer.id, fullName: customer.fullName, phoneNumber: customer.phoneNumber, email: customer.email }; }
  catch (error) { if (error instanceof ApplicationError && error.status === 404) throw new ApplicationError(422, "vehicleCustomerInvalid"); throw error; }
}
export async function getVehicle(db: D1Database, businessId: string, id: string): Promise<Vehicle> {
  if (!isUuid(id)) throw new ApplicationError(404, "vehicleNotFound");
  const row = await db.prepare("SELECT * FROM vehicles WHERE id = ? AND business_id = ?").bind(id, businessId).first<VehicleRow>();
  if (!row) throw new ApplicationError(404, "vehicleNotFound");
  return dto(row);
}
export async function listVehicles(db: D1Database, businessId: string, query: VehicleQuery): Promise<VehicleListResult> {
  const predicates = ["v.business_id = ?"]; const values: (string | number)[] = [businessId];
  if (query.customerId) { predicates.push("v.customer_id = ?"); values.push(query.customerId); }
  if (query.manufacturer) { predicates.push(`${manufacturerSql} = ?`); values.push(normalizeSearch(query.manufacturer)); }
  if (query.sizeCategory) { predicates.push("v.size_category = ?"); values.push(query.sizeCategory); }
  if (query.productionYear !== null) { predicates.push("v.production_year = ?"); values.push(query.productionYear); }
  for (const token of normalizeSearch(query.query).split(/\s+/u).filter(Boolean)) {
    const match = `%${escapeLike(token)}%`; const compact = token.replace(/[ .-]/gu, "");
    predicates.push(`(${manufacturerSql} LIKE ? ESCAPE '\\' OR ${modelSql} LIKE ? ESCAPE '\\' OR ${plateSql} LIKE ? ESCAPE '\\' OR ${foldHungarianSql("v.color")} LIKE ? ESCAPE '\\' OR ${foldHungarianSql("c.full_name")} LIKE ? ESCAPE '\\' OR ${compactPlateSql} LIKE ? ESCAPE '\\')`);
    values.push(match, match, match, match, match, compact ? `%${escapeLike(compact)}%` : match);
  }
  const where = predicates.join(" AND ");
  const count = await db.prepare(`SELECT COUNT(*) AS total ${joinSql} WHERE ${where}`).bind(...values).first<{ total: number }>();
  const total = count?.total ?? 0; const totalPages = Math.max(1, Math.ceil(total / query.pageSize)); const page = Math.min(query.page, totalPages);
  const nameSort = `${manufacturerSql} ASC, ${modelSql} ASC, v.id ASC`;
  const order = query.sort === "created_desc" ? "v.created_at DESC, v.id ASC" : query.sort === "year_desc" ? `v.production_year DESC, ${nameSort}` : nameSort;
  const rows = await db.prepare(`SELECT v.*, c.full_name AS customer_name, c.phone_number AS customer_phone, c.email AS customer_email ${joinSql} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values, query.pageSize, (page - 1) * query.pageSize).all<JoinedRow>();
  return { ...query, total, totalPages, page, items: rows.results.map(row => ({ ...dto(row), customer: { id: row.customer_id, fullName: row.customer_name, phoneNumber: row.customer_phone, email: row.customer_email } })) };
}
export async function getVehicleManufacturers(db: D1Database, businessId: string): Promise<string[]> {
  const result = await db.prepare("SELECT DISTINCT manufacturer FROM vehicles WHERE business_id = ? ORDER BY manufacturer LIMIT 200").bind(businessId).all<{ manufacturer: string }>();
  return result.results.map(row => row.manufacturer);
}
export async function getVehicleDetail(db: D1Database, businessId: string, id: string, requestedPage = 1): Promise<VehicleDetailResult> {
  const vehicle = await getVehicle(db, businessId, id); const customer = await requireCustomer(db, businessId, vehicle.customerId);
  const count = await db.prepare("SELECT COUNT(*) AS total FROM work_orders WHERE business_id = ? AND vehicle_id = ?").bind(businessId, id).first<{ total: number }>();
  const total = count?.total ?? 0; const pageSize = 10; const totalPages = Math.max(1, Math.ceil(total / pageSize)); const page = Math.min(requestedPage, totalPages);
  const jobs = await db.prepare("SELECT id, job_status AS status, COALESCE(finished_at, started_at, scheduled_at, created_at) AS date FROM work_orders WHERE business_id = ? AND vehicle_id = ? ORDER BY COALESCE(finished_at, started_at, scheduled_at, created_at) DESC, id ASC LIMIT ? OFFSET ?").bind(businessId, id, pageSize, (page - 1) * pageSize).all<Omit<VehicleServiceEntry, "services">>();
  const ids = jobs.results.map(job => job.id); const serviceNames = new Map<string, string[]>();
  if (ids.length) {
    const rows = await db.prepare(`SELECT work_order_id, name_snapshot FROM work_order_services WHERE business_id = ? AND work_order_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at, id`).bind(businessId, ...ids).all<{ work_order_id: string; name_snapshot: string }>();
    for (const row of rows.results) serviceNames.set(row.work_order_id, [...(serviceNames.get(row.work_order_id) ?? []), row.name_snapshot]);
  }
  return { vehicle, customer, serviceHistory: { total, page, pageSize, totalPages, items: jobs.results.map(job => ({ ...job, services: serviceNames.get(job.id) ?? [] })) } };
}
export async function createVehicle(db: D1Database, businessId: string, input: VehicleInput): Promise<Vehicle> {
  await requireCustomer(db, businessId, input.customerId); const now = new Date().toISOString();
  try {
    const row = await db.prepare("INSERT INTO vehicles (id, business_id, customer_id, manufacturer, model, production_year, registration_number, color, size_category, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *").bind(crypto.randomUUID(), businessId, input.customerId, input.manufacturer, input.model, input.productionYear, input.registrationNumber, input.color, input.sizeCategory, input.notes, now, now).first<VehicleRow>();
    if (!row) throw new ApplicationError(503, "unavailable"); return dto(row);
  } catch (error) { if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new ApplicationError(422, "vehicleCustomerInvalid"); throw error; }
}
export async function updateVehicle(db: D1Database, businessId: string, id: string, input: VehicleInput, version: number): Promise<Vehicle> {
  const current = await getVehicle(db, businessId, id);
  if (current.version !== version) throw new ApplicationError(409, "vehicleConflict");
  await requireCustomer(db, businessId, input.customerId);
  if (input.customerId !== current.customerId) {
    const linked = await db.prepare("SELECT id FROM work_orders WHERE vehicle_id = ? AND business_id = ? LIMIT 1").bind(id, businessId).first<{ id: string }>();
    if (linked) throw new ApplicationError(409, "vehicleOwnerLocked");
  }
  try {
    const row = await db.prepare("UPDATE vehicles SET customer_id = ?, manufacturer = ?, model = ?, production_year = ?, registration_number = ?, color = ?, size_category = ?, notes = ?, version = version + 1, updated_at = ? WHERE id = ? AND business_id = ? AND version = ? RETURNING *").bind(input.customerId, input.manufacturer, input.model, input.productionYear, input.registrationNumber, input.color, input.sizeCategory, input.notes, new Date().toISOString(), id, businessId, version).first<VehicleRow>();
    if (!row) throw new ApplicationError(409, "vehicleConflict"); return dto(row);
  } catch (error) {
    if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new ApplicationError(409, input.customerId !== current.customerId ? "vehicleOwnerLocked" : "vehicleCustomerInvalid");
    throw error;
  }
}
export async function deleteVehicle(db: D1Database, businessId: string, id: string, version: number): Promise<void> {
  const vehicle = await getVehicle(db, businessId, id);
  if (vehicle.version !== version) throw new ApplicationError(409, "vehicleConflict");
  try {
    const row = await db.prepare("DELETE FROM vehicles WHERE id = ? AND business_id = ? AND version = ? RETURNING id").bind(id, businessId, version).first<{ id: string }>();
    if (!row) throw new ApplicationError(409, "vehicleConflict");
  } catch (error) { if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new ApplicationError(409, "vehicleHasRecords"); throw error; }
}
