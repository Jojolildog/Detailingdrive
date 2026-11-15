import type { BusinessRow, SettingsRow } from "../db/schema.ts";
import { toSettings } from "../db/schema.ts";
import { canAccessBusiness, canProvisionBusiness } from "../lib/access.ts";
import type { Identity, OwnerConfiguration } from "../lib/access.ts";
import type { BusinessSettings } from "../lib/settings.ts";
import { ApplicationError } from "./errors.ts";

export async function resolveOwnerBusiness(db: D1Database, identity: Identity | null, configured: OwnerConfiguration): Promise<BusinessRow> {
  if (!identity) throw new ApplicationError(401, "unauthorized");
  let business = await db.prepare("SELECT * FROM businesses WHERE singleton_key = 'primary'").first<BusinessRow>();
  if (!business) {
    if (!configured.userId?.trim() && !configured.email?.trim()) throw new ApplicationError(503, "setup");
    if (!canProvisionBusiness(identity, configured)) throw new ApplicationError(403, "forbidden");
    // D1 batch is atomic. The singleton constraint makes simultaneous first
    // requests safe, and no visitor can claim an unconfigured workspace.
    await db.batch([
      db.prepare("INSERT INTO businesses (id, owner_user_id) VALUES (?, ?) ON CONFLICT(singleton_key) DO NOTHING").bind(crypto.randomUUID(), identity.userId),
      db.prepare("INSERT INTO business_settings (id, business_id) SELECT ?, id FROM businesses WHERE singleton_key = 'primary' AND owner_user_id = ? ON CONFLICT(business_id) DO NOTHING").bind(crypto.randomUUID(), identity.userId),
    ]);
    business = await db.prepare("SELECT * FROM businesses WHERE singleton_key = 'primary'").first<BusinessRow>();
  }
  if (!business || !canAccessBusiness(identity, business.owner_user_id)) throw new ApplicationError(403, "forbidden");
  return business;
}

export async function readSettings(db: D1Database, businessId: string): Promise<BusinessSettings> {
  const row = await db.prepare("SELECT * FROM business_settings WHERE business_id = ?").bind(businessId).first<SettingsRow>();
  if (!row) throw new ApplicationError(503, "unavailable");
  return toSettings(row);
}

export async function writeSettings(db: D1Database, businessId: string, value: BusinessSettings): Promise<BusinessSettings> {
  const row = await db.prepare(`UPDATE business_settings SET
    business_name = ?, locale = ?, theme = ?, currency = ?, timezone = ?, units = ?,
    electricity_price_per_kwh = ?, water_price_per_cubic_meter = ?, labor_cost_per_hour = ?,
    equipment_replacement_months = ?, version = version + 1, updated_at = ?
    WHERE business_id = ? AND version = ? RETURNING *`).bind(
    value.businessName, value.locale, value.theme, value.currency, value.timezone, value.units,
    value.electricityPricePerKwh, value.waterPricePerCubicMeter, value.laborCostPerHour,
    value.equipmentReplacementMonths, new Date().toISOString(), businessId, value.version,
  ).first<SettingsRow>();
  if (!row) throw new ApplicationError(409, "conflict");
  return toSettings(row);
}
