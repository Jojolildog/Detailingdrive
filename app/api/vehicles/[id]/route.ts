import { getOwnerContext } from "../../../../server/context";
import { vehicleGet, vehicleWrite, vehicleDelete } from "../../../../server/vehicles-api.ts";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: RouteContext) { return vehicleGet(request, (await params).id, getOwnerContext); }
export async function PUT(request: Request, { params }: RouteContext) { return vehicleWrite(request, getOwnerContext, (await params).id); }
export async function DELETE(request: Request, { params }: RouteContext) { return vehicleDelete(request, (await params).id, getOwnerContext); }
