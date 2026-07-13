import type { Context, Next } from "hono";
import { verifyJwt } from "../lib/auth.js";
import type { Variables } from "../lib/types.js";

export async function requireAuth(
  c: Context<{ Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const address = await verifyJwt(token);
  if (!address) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  c.set("walletAddress", address);
  await next();
}
