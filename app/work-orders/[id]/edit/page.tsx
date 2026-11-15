import { Application } from "../../../../server/application";
import { getWorkOrderDetail } from "../../../../server/work-orders.ts";
import { getDictionary } from "../../../../lib/i18n";
import { WorkOrderForm } from "../../../../components/work-orders/work-order-form";
export const dynamic = "force-dynamic";
export default async function EditWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Application section="workOrders" returnTo={`/work-orders/${id}/edit`} render={async ({ db, business }, settings) => {
    const detail = await getWorkOrderDetail(db, business.id, id); const d = getDictionary(settings.locale);
    return { title: d.workOrders.editTitle, description: d.workOrders.editDescription, content: <WorkOrderForm key={`${id}:${detail.workOrder.version}`} workOrder={detail.workOrder} initialCustomer={detail.customer} initialVehicle={detail.vehicle} locale={settings.locale}/> };
  }}/>;
}
