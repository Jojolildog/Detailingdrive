import { Application } from "../../../../server/application";
import { getCustomer } from "../../../../server/customers.ts";
import { CustomerForm } from "../../../../components/customers/customer-form";
import { getDictionary } from "../../../../lib/i18n";
export const dynamic = "force-dynamic";
export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Application section="customers" returnTo={`/customers/${id}/edit`} render={async ({ db, business }, settings) => {
    const customer = await getCustomer(db, business.id, id); const d = getDictionary(settings.locale);
    return { title: d.customers.editTitle, description: d.customers.editDescription, content: <CustomerForm key={`${customer.id}:${customer.version}`} customer={customer} locale={settings.locale}/> };
  }}/>;
}
