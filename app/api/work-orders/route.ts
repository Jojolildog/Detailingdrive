import { getOwnerContext } from "../../../server/context";
import { workOrdersGet, workOrderWrite } from "../../../server/work-orders-api.ts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return workOrdersGet(request, getOwnerContext); }
export async function POST(request: Request) { return workOrderWrite(request, getOwnerContext); }
