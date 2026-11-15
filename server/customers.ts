import { escapeLike, normalizeSearch, isUuid } from "../lib/customers.ts";
import type { Customer, CustomerInput, CustomerQuery, CustomerListResult, CustomerDetailResult, CustomerVehicle } from "../lib/customers.ts";
import { ApplicationError } from "./errors.ts";
import { foldHungarianSql } from "./search.ts";

type CustomerRow = { id: string; full_name: string; phone_number: string; email: string | null; notes: string; created_at: string; updated_at: string; version: number };
function dto(row: CustomerRow): Customer { return { id: row.id, fullName: row.full_name, phoneNumber: row.phone_number, email: row.email, notes: row.notes, createdDate: row.created_at, updatedAt: row.updated_at, version: row.version }; }
function requireId(id: string) { if (!isUuid(id)) throw new ApplicationError(404, "customerNotFound"); }
const foldedName = foldHungarianSql("full_name");
const foldedEmail = foldHungarianSql("email");
const phoneDigits = [" ", "+", "-", "(", ")", ".", "/"].reduce((sql, separator) => `REPLACE(${sql}, '${separator}', '')`, "phone_number");

export async function listCustomers(db: D1Database, businessId: string, input: CustomerQuery): Promise<CustomerListResult> {
  const predicates: string[] = ["business_id = ?"];
  const bindings: (string | number)[] = [businessId];
  for (const token of normalizeSearch(input.query).split(/\s+/u).filter(Boolean)) {
    predicates.push(`(${foldedName} LIKE ? ESCAPE '\\' OR ${foldedEmail} LIKE ? ESCAPE '\\' OR phone_number LIKE ? ESCAPE '\\' OR ${phoneDigits} LIKE ? ESCAPE '\\')`);
    const match = `%${escapeLike(token)}%`;
    const digits = token.replace(/\D/g, "");
    const phoneMatch = /^[+\d()./-]+$/u.test(token) && digits ? `%${digits}%` : match;
    bindings.push(match, match, match, phoneMatch);
  }
  const where = predicates.join(" AND ");
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM customers WHERE ${where}`).bind(...bindings).first<{ total: number }>();
  const total = count?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const sort = input.sort === "created_desc" ? "created_at DESC, id ASC" : `${foldedName} ${input.sort === "name_desc" ? "DESC" : "ASC"}, id ASC`;
  const rows = await db.prepare(`SELECT * FROM customers WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(...bindings, input.pageSize, (page - 1) * input.pageSize).all<CustomerRow>();
  return { ...input, items: rows.results.map(dto), total, page, totalPages };
}

export async function getCustomer(db: D1Database, businessId: string, id: string): Promise<Customer> {
  requireId(id);
  const row = await db.prepare("SELECT * FROM customers WHERE id = ? AND business_id = ?").bind(id, businessId).first<CustomerRow>();
  if (!row) throw new ApplicationError(404, "customerNotFound");
  return dto(row);
}

export async function getCustomerDetail(db: D1Database, businessId: string, id: string): Promise<CustomerDetailResult> {
  const customer = await getCustomer(db, businessId, id);
  const rows = await db.prepare("SELECT id, manufacturer, model, production_year AS productionYear, registration_number AS registrationNumber, color FROM vehicles WHERE customer_id = ? AND business_id = ? ORDER BY manufacturer, model, id").bind(id, businessId).all<CustomerVehicle>();
  return { customer, vehicles: rows.results };
}

export async function createCustomer(db: D1Database, businessId: string, input: CustomerInput): Promise<Customer> {
  const now = new Date().toISOString();
  const row = await db.prepare("INSERT INTO customers (id, business_id, full_name, phone_number, email, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *").bind(crypto.randomUUID(), businessId, input.fullName, input.phoneNumber, input.email, input.notes, now, now).first<CustomerRow>();
  if (!row) throw new ApplicationError(503, "unavailable");
  return dto(row);
}

export async function updateCustomer(db: D1Database, businessId: string, id: string, input: CustomerInput, version: number): Promise<Customer> {
  await getCustomer(db, businessId, id);
  const row = await db.prepare("UPDATE customers SET full_name = ?, phone_number = ?, email = ?, notes = ?, updated_at = ?, version = version + 1 WHERE id = ? AND business_id = ? AND version = ? RETURNING *").bind(input.fullName, input.phoneNumber, input.email, input.notes, new Date().toISOString(), id, businessId, version).first<CustomerRow>();
  if (!row) throw new ApplicationError(409, "customerConflict");
  return dto(row);
}

export async function deleteCustomer(db: D1Database, businessId: string, id: string, version: number): Promise<void> {
  const customer = await getCustomer(db, businessId, id);
  if (customer.version !== version) throw new ApplicationError(409, "customerConflict");
  try {
    const deleted = await db.prepare("DELETE FROM customers WHERE id = ? AND business_id = ? AND version = ? RETURNING id").bind(id, businessId, version).first<{ id: string }>();
    if (!deleted) throw new ApplicationError(409, "customerConflict");
  } catch (error) {
    // Keep registered vehicles and work history intact. Deletion never cascades.
    if (error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message)) throw new ApplicationError(409, "customerHasRecords");
    throw error;
  }
}
