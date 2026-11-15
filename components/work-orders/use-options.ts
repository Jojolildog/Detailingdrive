"use client";
import { useEffect, useState } from "react";
import { isRecord } from "../../lib/customers.ts";
export function useOptions<T>(url: string | null, guard: (value: unknown) => value is T) {
  const [stored, setStored] = useState<{ url: string; items: T[]; page: number; totalPages: number; total: number }>();
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!url) { setLoading(false); setError(""); return; } const controller = new AbortController(); setLoading(true); setError("");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(url, { credentials: "same-origin", signal: controller.signal }); const payload: unknown = await response.json();
        if (!response.ok) { if (!controller.signal.aborted) setError(isRecord(payload) && typeof payload.error === "string" ? payload.error : "optionsUnavailable"); return; }
        if (!isRecord(payload) || !Array.isArray(payload.items) || !payload.items.every(guard) || typeof payload.page !== "number" || typeof payload.totalPages !== "number" || typeof payload.total !== "number") throw new Error("Invalid options response");
        if (!controller.signal.aborted) setStored({ url, items: payload.items as T[], page: payload.page, totalPages: payload.totalPages, total: payload.total });
      } catch { if (!controller.signal.aborted) setError("optionsUnavailable"); } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [url, guard, attempt]);
  const result = stored?.url === url ? stored : { items: [] as T[], page: 1, totalPages: 1, total: 0 };
  return { ...result, loading, error, retry: () => setAttempt(current => current + 1) };
}
