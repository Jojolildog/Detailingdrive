import { Application } from "../../../server/application";
import { CustomerForm } from "../../../components/customers/customer-form";
import { getDictionary } from "../../../lib/i18n";
export const dynamic = "force-dynamic";
export default function NewCustomerPage() {
  return <Application section="customers" returnTo="/customers/new" render={async (_context, settings) => {
    const d = getDictionary(settings.locale);
    return { title: d.customers.newTitle, description: d.customers.newDescription, content: <CustomerForm locale={settings.locale}/> };
  }}/>;
}
