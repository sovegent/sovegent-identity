/**
 * In-memory sliding window rate limiter.
 * For multi-instance deployments, replace with Redis-backed limiter.
 */
import type { Context, Next } from "hono";

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

function getClientKey(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

function cleanup() {
  const now = Date.now();
  for (const [key, win] of store.entries()) {
    if (win.resetAt < now) store.delete(key);
  }
}

// Run cleanup every 5 minutes to prevent unbounded memory growth
setInterval(cleanup, 5 * 60 * 1000);

/**
 * Creates a rate-limit middleware.
 * @param max     Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(max: number, windowMs: number) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const key = getClientKey(c);
    const now = Date.now();

    let win = store.get(key);
    if (!win || win.resetAt < now) {
      win = { count: 0, resetAt: now + windowMs };
      store.set(key, win);
    }

    win.count++;

    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, max - win.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(win.resetAt / 1000)));

    if (win.count > max) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  };
}
