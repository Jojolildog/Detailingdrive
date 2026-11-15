import { Application } from "../../../server/application";
import { getWorkOrderDetail } from "../../../server/work-orders.ts";
import { getDictionary } from "../../../lib/i18n";
import { WorkOrderDetail } from "../../../components/work-orders/work-order-detail";
export const dynamic = "force-dynamic";
export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Application section="workOrders" returnTo={`/work-orders/${id}`} render={async ({ db, business }, settings) => {
    const detail = await getWorkOrderDetail(db, business.id, id); const d = getDictionary(settings.locale);
    return { title: `${d.workOrders.detailTitle} · ${detail.customer.fullName}`, description: d.workOrders.detailDescription, content: <WorkOrderDetail detail={detail} locale={settings.locale}/> };
  }}/>;
}
