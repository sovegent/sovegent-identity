import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { generateNonce, buildSiweMessage, verifySiweSignature, issueJwt } from "../lib/auth.js";
import { getDb } from "../db/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { Variables } from "../lib/types.js";

export const authRouter = new Hono<{ Variables: Variables }>();

const nonceBody = z.object({ address: z.string().min(10) });
const verifyBody = z.object({
  address: z.string(),
  signature: z.string().startsWith("0x"),
  message: z.string(),
});

authRouter.post("/nonce", zValidator("json", nonceBody), async (c) => {
  const { address } = c.req.valid("json");
  const nonce = generateNonce();
  const message = buildSiweMessage({ address, nonce });
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO nonces (nonce, address, expires_at) VALUES (?, ?, ?)").run(
    nonce, address.toLowerCase(), expiresAt
  );
  return c.json({ nonce, message });
});

authRouter.post("/verify", zValidator("json", verifyBody), async (c) => {
  const { address, signature, message } = c.req.valid("json");
  const db = getDb();
  const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
  if (!nonceMatch?.[1]) return c.json({ error: "Invalid message format" }, 400);
  const nonce = nonceMatch[1];
  const row = db.prepare("SELECT * FROM nonces WHERE nonce = ?").get(nonce) as
    | { address: string; expires_at: string; used: number } | undefined;
  if (!row) return c.json({ error: "Unknown nonce" }, 400);
  if (row.used) return c.json({ error: "Nonce already used" }, 400);
  if (new Date(row.expires_at) < new Date()) return c.json({ error: "Nonce expired" }, 400);
  if (row.address !== address.toLowerCase()) return c.json({ error: "Address mismatch" }, 400);
  const valid = await verifySiweSignature({
    message,
    signature: signature as `0x${string}`,
    expectedAddress: address,
  });
  if (!valid) return c.json({ error: "Invalid signature" }, 401);
  db.prepare("UPDATE nonces SET used = 1 WHERE nonce = ?").run(nonce);
  db.prepare(
    "INSERT INTO users (id) VALUES (?) ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now')"
  ).run(address.toLowerCase());
  const token = await issueJwt(address.toLowerCase());
  return c.json({ token, address: address.toLowerCase() });
});

authRouter.get("/me", requireAuth, (c) => {
  return c.json({ address: c.get("walletAddress") });
});
