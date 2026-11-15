import { Application } from "../../../server/application";
import { getServiceDetail } from "../../../server/services.ts";
import { getDictionary } from "../../../lib/i18n";
import { ServiceDetail } from "../../../components/services/service-detail";
export const dynamic = "force-dynamic";
export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Application section="services" returnTo={`/services/${id}`} render={async ({ db, business }, settings) => {
    const detail = await getServiceDetail(db, business.id, id); const d = getDictionary(settings.locale);
    return { title: detail.service.serviceName, description: d.services.detailDescription, content: <ServiceDetail detail={detail} locale={settings.locale}/> };
  }}/>;
}
