export const supportedLocales = ["hu", "en"] as const;
export type Locale = (typeof supportedLocales)[number];
export type Theme = "system" | "light" | "dark";

export type BusinessSettings = {
  businessName: string;
  locale: Locale;
  theme: Theme;
  currency: "HUF";
  timezone: "Europe/Budapest";
  units: "metric";
  electricityPricePerKwh: number | null;
  waterPricePerCubicMeter: number | null;
  laborCostPerHour: number | null;
  equipmentReplacementMonths: number;
  version: number;
};

export const defaultSettings: BusinessSettings = {
  businessName: "",
  locale: "hu",
  theme: "system",
  currency: "HUF",
  timezone: "Europe/Budapest",
  units: "metric",
  electricityPricePerKwh: null,
  waterPricePerCubicMeter: null,
  laborCostPerHour: null,
  equipmentReplacementMonths: 24,
  version: 1,
};

export type SettingsField = keyof BusinessSettings;
export type SettingsErrors = Partial<Record<SettingsField | "form", string>>;
type SettingsResult = { success: true; data: BusinessSettings } | { success: false; errors: SettingsErrors };

export function validateSettings(input: unknown): SettingsResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, errors: { form: "invalidInput" } };
  }
  const value = input as Record<string, unknown>;
  const errors: SettingsErrors = {};
  const allowed = Object.keys(defaultSettings);
  if (Object.keys(value).some((key) => !allowed.includes(key))) errors.form = "invalidInput";
  if (typeof value.businessName !== "string" || value.businessName.trim().length > 120) errors.businessName = "invalidName";
  if (value.locale !== "hu" && value.locale !== "en") errors.locale = "invalidChoice";
  if (!["system", "light", "dark"].includes(value.theme as string)) errors.theme = "invalidChoice";
  if (value.currency !== "HUF") errors.currency = "invalidChoice";
  if (value.timezone !== "Europe/Budapest") errors.timezone = "invalidChoice";
  if (value.units !== "metric") errors.units = "invalidChoice";
  for (const key of ["electricityPricePerKwh", "waterPricePerCubicMeter", "laborCostPerHour"] as const) {
    const n = value[key];
    if (n !== null && (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100_000_000)) errors[key] = "invalidAmount";
  }
  if (typeof value.equipmentReplacementMonths !== "number" || !Number.isInteger(value.equipmentReplacementMonths) || value.equipmentReplacementMonths < 1 || value.equipmentReplacementMonths > 600) {
    errors.equipmentReplacementMonths = "invalidMonths";
  }
  if (typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version < 1) errors.version = "invalidVersion";
  if (Object.keys(errors).length) return { success: false, errors };
  return { success: true, data: { ...value, businessName: (value.businessName as string).trim() } as BusinessSettings };
}
