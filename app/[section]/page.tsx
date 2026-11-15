import { notFound } from "next/navigation";
import { sectionFromSlug } from "../../lib/navigation";
import { Application } from "../../server/application";
export const dynamic = "force-dynamic";
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const section = sectionFromSlug(slug);
  if (!section) notFound();
  return <Application section={section}/>;
}
