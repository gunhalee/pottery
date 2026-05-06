import "server-only";

import { createHash } from "node:crypto";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  key: string;
  limit: number;
  namespace: string;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export type RateLimitBucketSnapshot = {
  blocked: number;
  count: number;
  expiresAt: string;
  keyHash: string;
  limit: number;
  namespace: string;
  remaining: number;
  updatedAt: string;
  windowSeconds: number;
  windowStart: string;
};

type RateLimitRpcRow = {
  allowed: boolean;
  limit_count: number;
  remaining: number;
  request_count: number;
  reset_at: string;
  retry_after_seconds: number;
};

type RateLimitBucketRow = {
  count: number;
  expires_at: string;
  key_hash: string;
  limit_count: number;
  namespace: string;
  updated_at: string;
  window_seconds: number;
  window_start: string;
};

const buckets = new Map<string, RateLimitBucket>();
const maxBuckets = 1_000;

export async function consumeRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const supabaseResult = await consumeSupabaseRateLimit(options);

  if (supabaseResult) {
    return supabaseResult;
  }

  return consumeMemoryRateLimit(options);
}

export async function readRateLimitBuckets(
  limit = 40,
): Promise<RateLimitBucketSnapshot[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("api_rate_limit_buckets")
    .select(
      "namespace, key_hash, window_start, count, limit_count, window_seconds, expires_at, updated_at",
    )
    .gt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRateLimitStorageError(error)) {
      return [];
    }

    throw new Error(`Failed to read rate limit buckets: ${error.message}`);
  }

  return ((data ?? []) as RateLimitBucketRow[]).map((row) => ({
    blocked: Math.max(0, row.count - row.limit_count),
    count: row.count,
    expiresAt: row.expires_at,
    keyHash: row.key_hash,
    limit: row.limit_count,
    namespace: row.namespace,
    remaining: Math.max(0, row.limit_count - row.count),
    updatedAt: row.updated_at,
    windowSeconds: row.window_seconds,
    windowStart: row.window_start,
  }));
}

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function rateLimitHeaders(rateLimit: RateLimitResult) {
  return {
    "Retry-After": String(rateLimit.retryAfterSeconds),
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
  };
}

async function consumeSupabaseRateLimit({
  key,
  limit,
  namespace,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc("consume_api_rate_limit", {
      p_key_hash: hashRateLimitKey(namespace, key),
      p_limit: limit,
      p_namespace: namespace,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    })
    .single();

  if (error) {
    if (!isMissingRateLimitStorageError(error)) {
      console.error(`Rate limit storage failed: ${error.message}`);
    }

    return null;
  }

  const row = data as RateLimitRpcRow;

  return {
    allowed: row.allowed,
    limit: row.limit_count,
    remaining: row.remaining,
    resetAt: new Date(row.reset_at).getTime(),
    retryAfterSeconds: row.retry_after_seconds,
  };
}

function consumeMemoryRateLimit({
  key,
  limit,
  namespace,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucketKey = `${namespace}:${key}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    pruneExpiredBuckets(now);

    const resetAt = now + windowMs;
    buckets.set(bucketKey, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  current.count += 1;

  if (current.count > limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: secondsUntil(current.resetAt, now),
    };
  }

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  };
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < maxBuckets) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  while (buckets.size >= maxBuckets) {
    const oldestKey = buckets.keys().next().value;

    if (!oldestKey) {
      break;
    }

    buckets.delete(oldestKey);
  }
}

function secondsUntil(timestamp: number, now: number) {
  return Math.max(1, Math.ceil((timestamp - now) / 1000));
}

function hashRateLimitKey(namespace: string, key: string) {
  return createHash("sha256").update(`${namespace}:${key}`).digest("hex");
}

function isMissingRateLimitStorageError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  return (
    error.code === "PGRST202" ||
    message.includes("api_rate_limit_buckets") ||
    message.includes("consume_api_rate_limit") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}
