import { isSameOriginJson } from "../lib/access.ts";
import { isRecord, isVersion } from "../lib/customers.ts";
import { parseServiceQuery, validateService } from "../lib/services.ts";
import { createService, deleteService, getServiceDetail, listServices, updateService } from "./services.ts";
import { ApplicationError } from "./errors.ts";
import { apiError, privateHeaders, privateJson, readBoundedJson } from "./http.ts";
type ResolveContext = () => Promise<{ db: D1Database; business: { id: string } }>;
export async function servicesGet(request: Request, resolve: ResolveContext) {
  try { const { db, business } = await resolve(); const query = parseServiceQuery(new URL(request.url).searchParams); if (!query) throw new ApplicationError(400, "invalidServiceQuery"); return privateJson(await listServices(db, business.id, query)); }
  catch (error) { return apiError(error); }
}
export async function serviceGet(id: string, resolve: ResolveContext) {
  try { const { db, business } = await resolve(); return privateJson(await getServiceDetail(db, business.id, id)); }
  catch (error) { return apiError(error); }
}
export async function serviceWrite(request: Request, resolve: ResolveContext, id?: string) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve(); const parsed = validateService(await readBoundedJson(request, 65_536), id !== undefined);
    if (!parsed.success) return privateJson({ error: "invalidInput", fields: parsed.errors, materials: parsed.materialErrors }, 422);
    const service = id === undefined ? await createService(db, business.id, parsed.data) : await updateService(db, business.id, id, parsed.data, parsed.version!);
    return privateJson({ service }, id === undefined ? 201 : 200, id === undefined ? { Location: `/services/${service.id}` } : {});
  } catch (error) { return apiError(error); }
}
export async function serviceDelete(request: Request, id: string, resolve: ResolveContext) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve(); const body = await readBoundedJson(request);
    if (!isRecord(body) || Object.keys(body).some(key => key !== "version") || !isVersion(body.version)) throw new ApplicationError(422, "invalidVersion");
    await deleteService(db, business.id, id, body.version); return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return apiError(error); }
}
