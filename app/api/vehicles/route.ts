import { getOwnerContext } from "../../../server/context";
import { vehiclesGet, vehicleWrite } from "../../../server/vehicles-api.ts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return vehiclesGet(request, getOwnerContext); }
export async function POST(request: Request) { return vehicleWrite(request, getOwnerContext); }
