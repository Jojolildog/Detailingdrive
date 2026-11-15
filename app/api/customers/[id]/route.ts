import { getOwnerContext } from "../../../../server/context";
import { customerGet, customerWrite, customerDelete } from "../../../../server/customers-api.ts";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: RouteContext) { return customerGet((await params).id, getOwnerContext); }
export async function PUT(request: Request, { params }: RouteContext) { return customerWrite(request, getOwnerContext, (await params).id); }
export async function DELETE(request: Request, { params }: RouteContext) { return customerDelete(request, (await params).id, getOwnerContext); }
