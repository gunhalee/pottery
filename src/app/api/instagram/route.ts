import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: "Instagram feed endpoint is not implemented yet.",
    },
    { status: 501 },
  );
}
