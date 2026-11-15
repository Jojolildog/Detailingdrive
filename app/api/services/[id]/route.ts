import { getOwnerContext } from "../../../../server/context";
import { serviceGet, serviceWrite, serviceDelete } from "../../../../server/services-api.ts";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: RouteContext) { return serviceGet((await params).id, getOwnerContext); }
export async function PUT(request: Request, { params }: RouteContext) { return serviceWrite(request, getOwnerContext, (await params).id); }
export async function DELETE(request: Request, { params }: RouteContext) { return serviceDelete(request, (await params).id, getOwnerContext); }
