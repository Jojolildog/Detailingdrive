import { escapeLike, isUuid, normalizeSearch } from "../lib/customers.ts";
import { isExpectedMaterial } from "../lib/services.ts";
import type { Service, ServiceInput, ServiceQuery, ServiceListResult, ServiceDetailResult, ServiceBundleComponent } from "../lib/services.ts";
import { ApplicationError } from "./errors.ts";
import { foldHungarianSql } from "./search.ts";
type ServiceRow = { id: string; name: string; description: string; default_price_huf: number | null; expected_duration_minutes: number | null; expected_materials_json: string; optional_cost_estimate_huf: number | null; active: number; service_type: Service["serviceType"]; created_at: string; updated_at: string; version: number };
function dto(row: ServiceRow): Service {
  let materials: unknown;
  try { materials = JSON.parse(row.expected_materials_json); } catch { throw new ApplicationError(503, "serviceMaterialsUnavailable"); }
  if (!Array.isArray(materials) || !materials.every(isExpectedMaterial)) throw new ApplicationError(503, "serviceMaterialsUnavailable");
  return { id: row.id, serviceName: row.name, description: row.description, defaultPrice: row.default_price_huf, expectedDuration: row.expected_duration_minutes, expectedMaterials: materials, optionalCostEstimate: row.optional_cost_estimate_huf, active: Boolean(row.active), serviceType: row.service_type, currency: "HUF", createdAt: row.created_at, updatedAt: row.updated_at, version: row.version };
}
async function serviceRow(db: D1Database, businessId: string, id: string): Promise<ServiceRow> {
  if (!isUuid(id)) throw new ApplicationError(404, "serviceNotFound");
  const row = await db.prepare("SELECT * FROM services WHERE id = ? AND business_id = ?").bind(id, businessId).first<ServiceRow>();
  if (!row) throw new ApplicationError(404, "serviceNotFound"); return row;
}
export async function getService(db: D1Database, businessId: string, id: string): Promise<Service> { return dto(await serviceRow(db, businessId, id)); }
export async function getServiceDetail(db: D1Database, businessId: string, id: string): Promise<ServiceDetailResult> {
  const service = await getService(db, businessId, id); let bundleComponents: ServiceBundleComponent[] = [];
  if (service.serviceType === "bundle") {
    const rows = await db.prepare("SELECT i.id, i.component_service_id AS serviceId, c.name AS serviceName, i.quantity FROM service_bundle_items i JOIN services c ON c.id = i.component_service_id AND c.business_id = i.business_id WHERE i.business_id = ? AND i.bundle_service_id = ? ORDER BY i.created_at, i.id").bind(businessId, id).all<ServiceBundleComponent>();
    bundleComponents = rows.results;
  }
  return { service, bundleComponents };
}
export async function listServices(db: D1Database, businessId: string, query: ServiceQuery): Promise<ServiceListResult> {
  const where = ["s.business_id = ?"]; const values: (string | number)[] = [businessId];
  if (query.status !== "all") { where.push("s.active = ?"); values.push(query.status === "active" ? 1 : 0); }
  if (query.minPrice !== null) { where.push("s.default_price_huf >= ?"); values.push(query.minPrice); }
  if (query.maxPrice !== null) { where.push("s.default_price_huf <= ?"); values.push(query.maxPrice); }
  if (query.maxDuration !== null) { where.push("s.expected_duration_minutes <= ?"); values.push(query.maxDuration); }
  for (const token of normalizeSearch(query.query).split(/\s+/u).filter(Boolean)) {
    where.push(`(${foldHungarianSql("s.name")} LIKE ? ESCAPE '\\' OR ${foldHungarianSql("s.description")} LIKE ? ESCAPE '\\')`);
    const value = `%${escapeLike(token)}%`; values.push(value, value);
  }
  const predicate = where.join(" AND "); const count = await db.prepare(`SELECT COUNT(*) AS total FROM services s WHERE ${predicate}`).bind(...values).first<{ total: number }>();
  const total = count?.total ?? 0; const totalPages = Math.max(1, Math.ceil(total / query.pageSize)); const page = Math.min(query.page, totalPages);
  const nameSort = `${foldHungarianSql("s.name")} ASC, s.id ASC`;
  const sort = query.sort === "price_asc" ? `s.default_price_huf IS NULL ASC, s.default_price_huf ASC, ${nameSort}` : query.sort === "price_desc" ? `s.default_price_huf IS NULL ASC, s.default_price_huf DESC, ${nameSort}` : query.sort === "duration_asc" ? `s.expected_duration_minutes IS NULL ASC, s.expected_duration_minutes ASC, ${nameSort}` : query.sort === "created_desc" ? "s.created_at DESC, s.id ASC" : nameSort;
  const rows = await db.prepare(`SELECT s.* FROM services s WHERE ${predicate} ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(...values, query.pageSize, (page - 1) * query.pageSize).all<ServiceRow>();
  return { ...query, total, totalPages, page, items: rows.results.map(dto) };
}
export async function createService(db: D1Database, businessId: string, input: ServiceInput): Promise<Service> {
  const now = new Date().toISOString();
  const row = await db.prepare("INSERT INTO services (id, business_id, name, description, default_price_huf, expected_duration_minutes, expected_materials_json, optional_cost_estimate_huf, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *").bind(crypto.randomUUID(), businessId, input.serviceName, input.description, input.defaultPrice, input.expectedDuration, JSON.stringify(input.expectedMaterials), input.optionalCostEstimate, input.active === false ? 0 : 1, now, now).first<ServiceRow>();
  if (!row) throw new ApplicationError(503, "unavailable"); return dto(row);
}
export async function updateService(db: D1Database, businessId: string, id: string, input: ServiceInput, version: number): Promise<Service> {
  const current = await serviceRow(db, businessId, id);
  if (current.version !== version) throw new ApplicationError(409, "serviceConflict");
  const active = input.active === undefined ? current.active : input.active ? 1 : 0;
  const row = await db.prepare("UPDATE services SET name = ?, description = ?, default_price_huf = ?, expected_duration_minutes = ?, expected_materials_json = ?, optional_cost_estimate_huf = ?, active = ?, updated_at = ?, version = version + 1 WHERE id = ? AND business_id = ? AND version = ? RETURNING *").bind(input.serviceName, input.description, input.defaultPrice, input.expectedDuration, JSON.stringify(input.expectedMaterials), input.optionalCostEstimate, active, new Date().toISOString(), id, businessId, version).first<ServiceRow>();
  if (!row) throw new ApplicationError(409, "serviceConflict"); return dto(row);
}
export async function deleteService(db: D1Database, businessId: string, id: string, version: number): Promise<void> {
  const current = await serviceRow(db, businessId, id);
  if (current.version !== version) throw new ApplicationError(409, "serviceConflict");
  try {
    const row = await db.prepare("DELETE FROM services WHERE id = ? AND business_id = ? AND version = ? RETURNING id").bind(id, businessId, version).first<{ id: string }>();
    if (!row) throw new ApplicationError(409, "serviceConflict");
  } catch (error) { if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new ApplicationError(409, "serviceInUse"); throw error; }
}
