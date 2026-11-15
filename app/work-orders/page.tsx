import Link from "next/link";
import { Application } from "../../server/application";
import { listWorkOrders } from "../../server/work-orders.ts";
import { parseWorkOrderQuery, workOrderListPath } from "../../lib/work-orders.ts";
import { getDictionary } from "../../lib/i18n";
import { WorkOrderList } from "../../components/work-orders/work-order-list";
export const dynamic = "force-dynamic";
export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams; const params = new URLSearchParams();
  for (const key of ["q", "customerId", "vehicleId", "jobStatus", "paymentStatus", "sort", "page", "pageSize"]) { const value = values[key]; if (typeof value === "string") params.set(key, value); }
  const query = parseWorkOrderQuery(params);
  return <Application section="workOrders" returnTo={query ? workOrderListPath(query) : "/work-orders"} render={async ({ db, business }, settings) => {
    const d = getDictionary(settings.locale);
    if (!query) return { content: <div className="panel form-section"><p role="alert">{d.workOrderErrors.invalidQuery}</p><Link className="button secondary" href="/work-orders">{d.workOrders.clear}</Link></div> };
    return { description: d.workOrders.description, content: <WorkOrderList result={await listWorkOrders(db, business.id, query)} locale={settings.locale}/> };
  }}/>;
}
