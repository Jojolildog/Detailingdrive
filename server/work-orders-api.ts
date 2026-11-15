import { isSameOriginJson } from "../lib/access.ts";
import { isRecord, isVersion } from "../lib/customers.ts";
import { parseWorkOrderQuery, validateWorkOrder } from "../lib/work-orders.ts";
import { createWorkOrder, updateWorkOrder, deleteWorkOrder, getWorkOrderDetail, listWorkOrders } from "./work-orders.ts";
import { ApplicationError } from "./errors.ts";
import { apiError, privateHeaders, privateJson, readBoundedJson } from "./http.ts";
type ResolveContext = () => Promise<{ db: D1Database; business: { id: string } }>;
export async function workOrdersGet(request: Request, resolve: ResolveContext) {
  try { const { db, business } = await resolve(); const query = parseWorkOrderQuery(new URL(request.url).searchParams); if (!query) throw new ApplicationError(400, "invalidQuery"); return privateJson(await listWorkOrders(db, business.id, query)); } catch (error) { return apiError(error); }
}
export async function workOrderGet(id: string, resolve: ResolveContext) {
  try { const { db, business } = await resolve(); return privateJson(await getWorkOrderDetail(db, business.id, id)); } catch (error) { return apiError(error); }
}
export async function workOrderWrite(request: Request, resolve: ResolveContext, id?: string) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve(); const parsed = validateWorkOrder(await readBoundedJson(request, 65536), id !== undefined);
    if (!parsed.success) return privateJson({ error: "invalidInput", fields: parsed.errors }, 422);
    const workOrder = id === undefined ? await createWorkOrder(db, business.id, parsed.data) : await updateWorkOrder(db, business.id, id, parsed.data, parsed.version!);
    return privateJson({ workOrder }, id === undefined ? 201 : 200, id === undefined ? { Location: `/work-orders/${workOrder.id}` } : {});
  } catch (error) { return apiError(error); }
}
export async function workOrderDelete(request: Request, id: string, resolve: ResolveContext) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden"); const { db, business } = await resolve(); const body = await readBoundedJson(request);
    if (!isRecord(body) || Object.keys(body).some(key => key !== "version") || !isVersion(body.version)) throw new ApplicationError(422, "invalidVersion");
    await deleteWorkOrder(db, business.id, id, body.version); return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return apiError(error); }
}
