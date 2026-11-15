import { env } from "cloudflare:workers";
export function getDatabase(): D1Database {
  if (!env.DB) {
    throw new Error(
      "The DetailFlow D1 database is unavailable."
    );
  }

  return env.DB;
}
