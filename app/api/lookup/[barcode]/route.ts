import { NextResponse } from "next/server";
import { lookupOff } from "@/lib/off";

// Signed-in only (proxy.ts returns 401 without a session), so anonymous
// traffic can't burn the shared 15 req/min OFF budget.
export async function GET(_req: Request, ctx: RouteContext<"/api/lookup/[barcode]">) {
  const { barcode } = await ctx.params;
  if (!/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: "Barcode must be 8 to 14 digits" }, { status: 400 });
  }
  return NextResponse.json(await lookupOff(barcode));
}
