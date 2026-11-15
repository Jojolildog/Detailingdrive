import Link from "next/link";
import { Application } from "../../server/application";
import { listServices } from "../../server/services.ts";
import { parseServiceQuery, serviceListPath } from "../../lib/services.ts";
import { getDictionary } from "../../lib/i18n";
import { ServiceList } from "../../components/services/service-list";
export const dynamic = "force-dynamic";
export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams; const params = new URLSearchParams();
  for (const key of ["q", "status", "minPrice", "maxPrice", "maxDuration", "sort", "page", "pageSize"]) if (typeof values[key] === "string") params.set(key, values[key]);
  const query = parseServiceQuery(params);
  return <Application section="services" returnTo={query ? serviceListPath(query) : "/services"} render={async ({ db, business }, settings) => {
    const d = getDictionary(settings.locale);
    if (!query) return { description: d.services.description, content: <div className="panel form-section"><p role="alert">{d.serviceErrors.invalidServiceQuery}</p><Link className="button secondary" href="/services">{d.services.clearFilters}</Link></div> };
    return { description: d.services.description, content: <ServiceList result={await listServices(db, business.id, query)} locale={settings.locale}/> };
  }}/>;
}
