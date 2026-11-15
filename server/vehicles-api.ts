import { isSameOriginJson } from "../lib/access.ts";
import { isRecord, isVersion } from "../lib/customers.ts";
import { parseVehicleQuery, parseHistoryPage, validateVehicle } from "../lib/vehicles.ts";
import { createVehicle, deleteVehicle, getVehicleDetail, listVehicles, updateVehicle } from "./vehicles.ts";
import { ApplicationError } from "./errors.ts";
import { apiError, privateHeaders, privateJson, readBoundedJson } from "./http.ts";
type ResolveContext = () => Promise<{ db: D1Database; business: { id: string } }>;
export async function vehiclesGet(request: Request, resolve: ResolveContext) {
  try { const { db, business } = await resolve(); const query = parseVehicleQuery(new URL(request.url).searchParams); if (!query) throw new ApplicationError(400, "invalidVehicleQuery"); return privateJson(await listVehicles(db, business.id, query)); }
  catch (error) { return apiError(error); }
}
export async function vehicleGet(request: Request, id: string, resolve: ResolveContext) {
  try { const { db, business } = await resolve(); const page = parseHistoryPage(new URL(request.url).searchParams); if (page === null) throw new ApplicationError(400, "invalidVehicleQuery"); return privateJson(await getVehicleDetail(db, business.id, id, page)); }
  catch (error) { return apiError(error); }
}
export async function vehicleWrite(request: Request, resolve: ResolveContext, id?: string) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve(); const parsed = validateVehicle(await readBoundedJson(request, 65_536), id !== undefined);
    if (!parsed.success) return privateJson({ error: "invalidInput", fields: parsed.errors }, 422);
    const vehicle = id === undefined ? await createVehicle(db, business.id, parsed.data) : await updateVehicle(db, business.id, id, parsed.data, parsed.version!);
    return privateJson({ vehicle }, id === undefined ? 201 : 200, id === undefined ? { Location: `/vehicles/${vehicle.id}` } : {});
  } catch (error) { return apiError(error); }
}
export async function vehicleDelete(request: Request, id: string, resolve: ResolveContext) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve(); const body = await readBoundedJson(request);
    if (!isRecord(body) || Object.keys(body).some(key => key !== "version") || !isVersion(body.version)) throw new ApplicationError(422, "invalidVersion");
    await deleteVehicle(db, business.id, id, body.version);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return apiError(error); }
}
