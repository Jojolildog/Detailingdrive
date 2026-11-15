import { ApplicationError } from "./errors.ts";
export const privateHeaders = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
export function privateJson(value: unknown, status = 200, extraHeaders: Record<string, string> = {}) { return Response.json(value, { status, headers: { ...privateHeaders, ...extraHeaders } }); }
export function apiError(error: unknown) {
  if (error instanceof ApplicationError) return privateJson({ error: error.code }, error.status);
  console.error("DetailFlow request failed", error instanceof Error ? error.name : "UnknownError");
  return privateJson({ error: "unavailable" }, 503);
}
export async function readBoundedJson(request: Request, maximumBytes = 16_384): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApplicationError(400, "invalidInput");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) { await reader.cancel(); throw new ApplicationError(413, "invalidInput"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError(400, "invalidInput");
  } finally { reader.releaseLock(); }
}
