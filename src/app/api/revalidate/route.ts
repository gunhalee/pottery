import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const payloadSchema = z.object({
  paths: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
});
const revalidateRateLimit = {
  limit: 30,
  windowMs: 60_000,
};

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        message: "REVALIDATE_SECRET is not configured.",
      },
      { status: 503 },
    );
  }

  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: revalidateRateLimit.limit,
    namespace: "revalidate",
    windowMs: revalidateRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: "Too many revalidation requests.",
      },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const requestSecret =
    request.headers.get("x-revalidate-secret") ??
    request.nextUrl.searchParams.get("secret");

  if (requestSecret !== secret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid revalidation secret.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid revalidation payload.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  if (parsed.data.paths.length === 0 && parsed.data.tags.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "At least one path or tag is required.",
      },
      { status: 400 },
    );
  }

  for (const path of parsed.data.paths) {
    revalidatePath(path);
  }

  for (const tag of parsed.data.tags) {
    revalidateTag(tag, "max");
  }

  return NextResponse.json({
    ok: true,
    revalidated: {
      paths: parsed.data.paths,
      tags: parsed.data.tags,
    },
  });
}
