import { Env, errorResponse } from "../types.js";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60; // per IP per minute

/**
 * Simple sliding-window rate limiter backed by Cloudflare KV.
 * Returns a 429 Response when the limit is exceeded, otherwise null.
 */
export async function rateLimit(
  request: Request,
  env: Env
): Promise<Response | null> {
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For") ??
    "unknown";

  const key = `rl:${ip}:${Math.floor(Date.now() / 1000 / WINDOW_SECONDS)}`;

  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= MAX_REQUESTS) {
    return errorResponse("Rate limit exceeded. Try again in a minute.", 429);
  }

  await env.RATE_LIMIT.put(key, String(count + 1), {
    expirationTtl: WINDOW_SECONDS * 2,
  });

  return null;
}
