import { accentPairs } from "../lib/customers.ts";
type SearchColumn = "full_name" | "email" | "v.manufacturer" | "v.model" | "v.registration_number" | "v.color" | "c.full_name" | "manufacturer";
export function foldHungarianSql(column: SearchColumn): string {
  return `LOWER(${accentPairs.reduce((sql, [letter, base]) => `REPLACE(${sql}, '${letter}', '${base}')`, column as string)})`;
}
