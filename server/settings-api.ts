import { isSameOriginJson } from "../lib/access.ts";
import { validateSettings } from "../lib/settings.ts";
import { readSettings, writeSettings } from "./business.ts";
import { ApplicationError } from "./errors.ts";

type Context = { db: D1Database; business: { id: string } };
type ResolveContext = () => Promise<Context>;
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
function json(value: unknown, status = 200) { return Response.json(value, { status, headers }); }

function apiError(error: unknown) {
  if (error instanceof ApplicationError) return json({ error: error.code }, error.status);
  // Database errors and internal exception text never reach the browser.
  console.error("DetailFlow settings request failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "unavailable" }, 503);
}

export async function getSettingsResponse(resolve: ResolveContext) {
  try {
    const { db, business } = await resolve();
    return json({ settings: await readSettings(db, business.id) });
  } catch (error) { return apiError(error); }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApplicationError(400, "invalidInput");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_384) {
        await reader.cancel();
        throw new ApplicationError(413, "invalidInput");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError(400, "invalidInput");
  } finally { reader.releaseLock(); }
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
