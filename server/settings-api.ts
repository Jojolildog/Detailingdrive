import { isSameOriginJson } from "../lib/access.ts";
import { validateSettings } from "../lib/settings.ts";
import { readSettings, writeSettings } from "./business.ts";
import { ApplicationError } from "./errors.ts";
import { privateJson as json, apiError, readBoundedJson } from "./http.ts";

type Context = { db: D1Database; business: { id: string } };
type ResolveContext = () => Promise<Context>;
export async function getSettingsResponse(resolve: ResolveContext) {
  try {
    const { db, business } = await resolve();
    return json({ settings: await readSettings(db, business.id) });
  } catch (error) { return apiError(error); }
}

export async function putSettingsResponse(request: Request, resolve: ResolveContext) {
  try {
    if (!isSameOriginJson(request)) throw new ApplicationError(403, "forbidden");
    const { db, business } = await resolve();
    const parsed = validateSettings(await readBoundedJson(request));
    if (!parsed.success) return json({ error: "invalidInput", fields: parsed.errors }, 422);
    return json({ settings: await writeSettings(db, business.id, parsed.data) });
  } catch (error) { return apiError(error); }
}
