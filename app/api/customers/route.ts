import { getOwnerContext } from "../../../server/context";
import { customersGet, customerWrite } from "../../../server/customers-api.ts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return customersGet(request, getOwnerContext); }
export async function POST(request: Request) { return customerWrite(request, getOwnerContext); }
