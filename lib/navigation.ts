export const navigation = [
  { key: "dashboard", path: "/", icon: "dashboard", phase: 0 },
  { key: "customers", path: "/customers", icon: "users", phase: 1 },
  { key: "vehicles", path: "/vehicles", icon: "car", phase: 2 },
  { key: "workOrders", path: "/work-orders", icon: "clipboard", phase: 3 },
  { key: "services", path: "/services", icon: "sparkles", phase: 4 },
  { key: "inventory", path: "/inventory", icon: "flask", phase: 5 },
  { key: "equipment", path: "/equipment", icon: "tool", phase: 6 },
  { key: "reports", path: "/reports", icon: "chart", phase: 7 },
  { key: "settings", path: "/settings", icon: "settings", phase: 0 },
] as const;
export type Section = (typeof navigation)[number]["key"];
export function sectionFromSlug(slug: string): Section | undefined {
  return navigation.find((entry) => entry.path === `/${slug}`)?.key;
}
