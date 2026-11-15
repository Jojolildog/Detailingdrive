import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getDatabase } from "../db/index";
import { resolveOwnerBusiness } from "./business.ts";

export async function getOwnerContext() {
  const user = await getChatGPTUser();
  const db = getDatabase();
  const configured = env as unknown as { DETAILFLOW_OWNER_USER_ID?: string; DETAILFLOW_OWNER_EMAIL?: string };
  const business = await resolveOwnerBusiness(db, user, {
    userId: configured.DETAILFLOW_OWNER_USER_ID,
    email: configured.DETAILFLOW_OWNER_EMAIL,
  });
  return { db, business, user: user! };
}
