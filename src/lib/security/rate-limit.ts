import "server-only";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  namespace: string;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateLimitBucket>();
const maxBuckets = 1_000;

export function consumeRateLimit({
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

  if (current.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: secondsUntil(current.resetAt, now),
    };
  }

  current.count += 1;

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  };
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
