import Link from "next/link";
import { Application } from "../../server/application";
import { listCustomers } from "../../server/customers.ts";
import { parseCustomerQuery, customerListPath } from "../../lib/customers.ts";
import { getDictionary } from "../../lib/i18n";
import { CustomerList } from "../../components/customers/customer-list";
export const dynamic = "force-dynamic";
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams; const params = new URLSearchParams();
  for (const key of ["q", "sort", "page", "pageSize"]) { const value = values[key]; if (typeof value === "string") params.set(key, value); }
  const query = parseCustomerQuery(params);
  return <Application section="customers" returnTo={query ? customerListPath(query) : "/customers"} render={async ({ db, business }, settings) => {
    const d = getDictionary(settings.locale);
    if (!query) return { content: <div className="panel form-section"><p role="alert">{d.customerErrors.invalidCustomerQuery}</p><Link href="/customers" className="button secondary">{d.customers.clearSearch}</Link></div> };
    return { content: <CustomerList result={await listCustomers(db, business.id, query)} locale={settings.locale}/> };
  }}/>;
}
