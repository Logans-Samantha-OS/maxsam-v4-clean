import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ ok: true, id: params.id });
}
