import { hu } from "./hu.ts";
import { en } from "./en.ts";
import type { Locale } from "../settings.ts";
type StringLeaves<T> = { [K in keyof T]: T[K] extends string ? string : StringLeaves<T[K]> };
export type Dictionary = StringLeaves<typeof hu>;
export function getDictionary(locale: Locale): Dictionary { return locale === "en" ? en : hu; }
export function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-GB", { timeZone: "Europe/Budapest", year: "numeric", month: "long", day: "numeric" }).format(date);
}
