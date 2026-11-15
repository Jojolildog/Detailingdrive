import { Application } from "../../../server/application";
import { getCustomerDetail } from "../../../server/customers.ts";
import { CustomerDetail } from "../../../components/customers/customer-detail";
import { getDictionary } from "../../../lib/i18n";
export const dynamic = "force-dynamic";
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Application section="customers" returnTo={`/customers/${id}`} render={async ({ db, business }, settings) => {
    const detail = await getCustomerDetail(db, business.id, id);
    return { title: detail.customer.fullName, description: getDictionary(settings.locale).customers.detailDescription, content: <CustomerDetail detail={detail} locale={settings.locale}/> };
  }}/>;
}
