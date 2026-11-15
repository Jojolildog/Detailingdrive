import { Application } from "../../../../server/application";
import { getService } from "../../../../server/services.ts";
import { getDictionary } from "../../../../lib/i18n";
import { ServiceForm } from "../../../../components/services/service-form";
export const dynamic = "force-dynamic";
export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Application section="services" returnTo={`/services/${id}/edit`} render={async ({ db, business }, settings) => {
    const service = await getService(db, business.id, id); const d = getDictionary(settings.locale);
    return { title: d.services.editTitle, description: d.services.editDescription, content: <ServiceForm key={`${service.id}:${service.version}`} service={service} locale={settings.locale}/> };
  }}/>;
}
