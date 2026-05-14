import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { validateRequestBodySize } from "@/lib/security/request-size";
import { publicCacheTags } from "@/lib/cache/public-cache-tags";

const payloadSchema = z.object({
  paths: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
});
const revalidateRateLimit = {
  limit: 30,
  windowMs: 60_000,
};
const maxRevalidateBodyBytes = 8 * 1024;
const allowedRevalidateTags = new Set([
  publicCacheTags.content,
  publicCacheTags.contentKind("gallery"),
  publicCacheTags.contentKind("news"),
  publicCacheTags.naverBlog,
  publicCacheTags.products,
]);
const allowedRevalidatePathPrefixes = [
  "/class",
  "/gallery",
  "/intro",
  "/news",
  "/privacy",
  "/shipping-returns",
  "/shop",
  "/terms",
];

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

  const requestSecret = request.headers.get("x-revalidate-secret");

  if (requestSecret !== secret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid revalidation secret.",
      },
      { status: 401 },
    );
  }

  const sizeCheck = validateRequestBodySize(
    request.headers,
    maxRevalidateBodyBytes,
    { requireContentLength: true },
  );
  if (!sizeCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: sizeCheck.error,
      },
      { status: sizeCheck.status },
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

  const paths = unique(parsed.data.paths);
  const tags = unique(parsed.data.tags);
  const invalidPaths = paths.filter((path) => !isAllowedRevalidatePath(path));
  const invalidTags = tags.filter((tag) => !allowedRevalidateTags.has(tag));

  if (invalidPaths.length > 0 || invalidTags.length > 0) {
    return NextResponse.json(
      {
        invalidPaths,
        invalidTags,
        ok: false,
        message: "Revalidation target is not allowed.",
      },
      { status: 400 },
    );
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  for (const tag of tags) {
    revalidateTag(tag, "max");
  }

  return NextResponse.json(
    {
      ok: true,
      revalidated: {
        paths,
        tags,
      },
    },
    { headers: rateLimitHeaders(rateLimit) },
  );
}

function isAllowedRevalidatePath(path: string) {
  if (
    path !== "/" &&
    (!path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("..") ||
      path.includes("\\"))
  ) {
    return false;
  }

  return (
    path === "/" ||
    allowedRevalidatePathPrefixes.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}
