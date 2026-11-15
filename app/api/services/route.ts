import { getOwnerContext } from "../../../server/context";
import { servicesGet, serviceWrite } from "../../../server/services-api.ts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return servicesGet(request, getOwnerContext); }
export async function POST(request: Request) { return serviceWrite(request, getOwnerContext); }
