import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { randomBytes, bytesToHex } from "@noble/hashes/utils";
import { getDb } from "../db/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { Variables } from "../lib/types.js";

export const attestationsRouter = new Hono<{ Variables: Variables }>();

const createBody = z.object({
  subject: z.string().min(10),
  claimJson: z.string(),
  proofJson: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string().optional(),
});

const anchorBody = z.object({
  chain: z.string().min(1),
  txHash: z.string().min(10),
  blockNumber: z.number().optional(),
});

attestationsRouter.post("/", requireAuth, zValidator("json", createBody), (c) => {
  const { subject, claimJson, proofJson, issuedAt, expiresAt } = c.req.valid("json");
  const issuer = c.get("walletAddress");
  const id = `urn:sovegent:attestation:${bytesToHex(randomBytes(16))}`;
  const db = getDb();
  db.prepare(
    "INSERT INTO attestations (id, issuer_id, subject_id, claim_json, proof_json, issued_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, issuer, subject.toLowerCase(), claimJson, proofJson, issuedAt, expiresAt ?? null);
  const row = db.prepare("SELECT * FROM attestations WHERE id = ?").get(id) as Record<string, unknown>;
  return c.json(formatAttestation(row), 201);
});

attestationsRouter.get("/", requireAuth, (c) => {
  const issuer = c.get("walletAddress");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);
  const offset = parseInt(c.req.query("offset") ?? "0");
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM attestations WHERE issuer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(issuer, limit, offset) as Record<string, unknown>[];
  const total = (db.prepare("SELECT COUNT(*) as n FROM attestations WHERE issuer_id = ?").get(issuer) as { n: number }).n;
  return c.json({ items: rows.map(formatAttestation), total, limit, offset });
});

attestationsRouter.get("/:id", (c) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM attestations WHERE id = ?").get(
    decodeURIComponent(c.req.param("id"))
  ) as Record<string, unknown> | undefined;
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(formatAttestation(row));
});

attestationsRouter.get("/subject/:address", (c) => {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM attestations WHERE subject_id = ? ORDER BY created_at DESC"
  ).all(c.req.param("address").toLowerCase()) as Record<string, unknown>[];
  return c.json(rows.map(formatAttestation));
});

attestationsRouter.post("/:id/anchor", requireAuth, zValidator("json", anchorBody), (c) => {
  const issuer = c.get("walletAddress");
  const id = decodeURIComponent(c.req.param("id"));
  const { chain, txHash, blockNumber } = c.req.valid("json");
  const db = getDb();
  const row = db.prepare("SELECT issuer_id, anchor_json FROM attestations WHERE id = ?").get(id) as
    | { issuer_id: string; anchor_json: string | null } | undefined;
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.issuer_id !== issuer) return c.json({ error: "Forbidden" }, 403);
  if (row.anchor_json) return c.json({ error: "Already anchored" }, 409);
  const anchor = { chain, txHash, blockNumber: blockNumber ?? null, anchoredAt: new Date().toISOString() };
  db.prepare("UPDATE attestations SET anchor_json = ? WHERE id = ?").run(JSON.stringify(anchor), id);
  const updated = db.prepare("SELECT * FROM attestations WHERE id = ?").get(id) as Record<string, unknown>;
  return c.json(formatAttestation(updated));
});

function formatAttestation(row: Record<string, unknown>) {
  return {
    id: row["id"], issuerId: row["issuer_id"], subjectId: row["subject_id"],
    claim: JSON.parse(row["claim_json"] as string),
    proof: JSON.parse(row["proof_json"] as string),
    anchor: row["anchor_json"] ? JSON.parse(row["anchor_json"] as string) : null,
    issuedAt: row["issued_at"], expiresAt: row["expires_at"] ?? null, createdAt: row["created_at"],
  };
}
