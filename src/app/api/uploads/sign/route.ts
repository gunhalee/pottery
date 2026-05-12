import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Direct upload signing is not used in the current upload flow. Use the scoped upload endpoints instead.",
    },
    { status: 410 },
  );
}
