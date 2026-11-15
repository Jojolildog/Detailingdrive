import { getOwnerContext } from "../../../server/context";
import { getSettingsResponse, putSettingsResponse } from "../../../server/settings-api.ts";

export const dynamic = "force-dynamic";
export async function GET() { return getSettingsResponse(getOwnerContext); }
export async function PUT(request: Request) { return putSettingsResponse(request, getOwnerContext); }
