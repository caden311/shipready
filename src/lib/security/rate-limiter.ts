const MAX_SCANS_PER_HOUR = 10;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  error?: string;
}

export async function checkRateLimit(
  ip: string,
  kv: KVNamespace | undefined
): Promise<RateLimitResult> {
  // If no KV binding (local dev), allow all requests
  if (!kv) {
    return { allowed: true, remaining: MAX_SCANS_PER_HOUR };
  }

  const key = `rate:${ip}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= MAX_SCANS_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      error: `Rate limit exceeded. You can scan up to ${MAX_SCANS_PER_HOUR} URLs per hour. Please try again later.`,
    };
  }

  await kv.put(key, String(count + 1), { expirationTtl: 3600 });

  return {
    allowed: true,
    remaining: MAX_SCANS_PER_HOUR - count - 1,
  };
}
