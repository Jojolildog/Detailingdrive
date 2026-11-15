import { isSameOriginJson } from "../lib/access.ts";
import { isRecord, isVersion, parseCustomerQuery, validateCustomer } from "../lib/customers.ts";
import { listCustomers, getCustomerDetail, createCustomer, updateCustomer, deleteCustomer } from "./customers.ts";
import { ApplicationError } from "./errors.ts";
import { apiError, privateHeaders, privateJson, readBoundedJson } from "./http.ts";
type ResolveContext = () => Promise<{ db: D1Database; business: { id: string } }>;

export async function customersGet(request: Request, resolve: ResolveContext) {
  try {
    const { db, business } = await resolve();
    const query = parseCustomerQuery(new URL(request.url).searchParams);
    if (!query) throw new ApplicationError(400, "invalidCustomerQuery");
    return privateJson(await listCustomers(db, business.id, query));
  } catch (error) { return apiError(error); }
}
export async function customerGet(id: string, resolve: ResolveContext) {
  try { const { db, business } = await resolve(); return privateJson(await getCustomerDetail(db, business.id, id)); }
  catch (error) { return apiError(error); }
}
export async function customerWrite(request: Request, resolve: ResolveContext, id?: string) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve();
    const parsed = validateCustomer(await readBoundedJson(request, 65_536), id !== undefined);
    if (!parsed.success) return privateJson({ error: "invalidInput", fields: parsed.errors }, 422);
    const customer = id === undefined ? await createCustomer(db, business.id, parsed.data) : await updateCustomer(db, business.id, id, parsed.data, parsed.version!);
    return privateJson({ customer }, id === undefined ? 201 : 200, id === undefined ? { Location: `/customers/${customer.id}` } : {});
  } catch (error) { return apiError(error); }
}
export async function customerDelete(request: Request, id: string, resolve: ResolveContext) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve();
    const body = await readBoundedJson(request);
    if (!isRecord(body) || Object.keys(body).some(key => key !== "version") || !isVersion(body.version)) throw new ApplicationError(422, "invalidVersion");
    await deleteCustomer(db, business.id, id, body.version);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return apiError(error); }
}
