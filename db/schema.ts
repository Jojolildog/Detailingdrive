import type { BusinessSettings } from "../lib/settings.ts";

// Versioned SQL in drizzle/ is the canonical schema. These server-only row
// types describe D1 query results. Public DTOs use camelCase.
export type BusinessRow = {
  id: string; singleton_key: "primary"; owner_user_id: string;
  created_at: string; updated_at: string;
};
export type SettingsRow = {
  id: string; business_id: string; business_name: string;
  locale: BusinessSettings["locale"]; theme: BusinessSettings["theme"];
  currency: "HUF"; timezone: "Europe/Budapest"; units: "metric";
  electricity_price_per_kwh: number | null;
  water_price_per_cubic_meter: number | null;
  labor_cost_per_hour: number | null;
  equipment_replacement_months: number; version: number;
  created_at: string; updated_at: string;
};
export function toSettings(row: SettingsRow): BusinessSettings {
  return {
    businessName: row.business_name, locale: row.locale, theme: row.theme,
    currency: row.currency, timezone: row.timezone, units: row.units,
    electricityPricePerKwh: row.electricity_price_per_kwh,
    waterPricePerCubicMeter: row.water_price_per_cubic_meter,
    laborCostPerHour: row.labor_cost_per_hour,
    equipmentReplacementMonths: row.equipment_replacement_months,
    version: row.version,
  };
}
