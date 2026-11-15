import { Application } from "../../../server/application";
import { getDictionary } from "../../../lib/i18n";
import { ServiceForm } from "../../../components/services/service-form";
export const dynamic = "force-dynamic";
export default async function NewServicePage() {
  return <Application section="services" returnTo="/services/new" render={async (_context, settings) => {
    const d = getDictionary(settings.locale);
    return { title: d.services.newTitle, description: d.services.newDescription, content: <ServiceForm locale={settings.locale}/> };
  }}/>;
}
