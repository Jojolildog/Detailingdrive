import { getOwnerContext } from "../../../../server/context";
import { workOrderGet, workOrderWrite, workOrderDelete } from "../../../../server/work-orders-api.ts";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: RouteContext) { return workOrderGet((await params).id, getOwnerContext); }
export async function PUT(request: Request, { params }: RouteContext) { return workOrderWrite(request, getOwnerContext, (await params).id); }
export async function DELETE(request: Request, { params }: RouteContext) { return workOrderDelete(request, (await params).id, getOwnerContext); }
