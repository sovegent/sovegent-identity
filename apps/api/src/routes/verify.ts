/**
 * Public verification endpoint
 * GET /verify/:id   → verify any proof by ID (notarization or attestation)
 */
import { Hono } from "hono";
import { getDb } from "../db/index.js";

export const verifyRouter = new Hono();

verifyRouter.get("/:id", (c) => {
  const id = c.req.param("id");
  const db = getDb();

  // Try notarization first
  const notarization = db.prepare("SELECT * FROM notarizations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (notarization) {
    const proof = JSON.parse(notarization["proof_json"] as string);
    return c.json({
      type: "notarization",
      id,
      documentHash: notarization["document_hash"],
      mimeType: notarization["mime_type"],
      label: notarization["label"],
      signer: proof.verificationMethod,
      algorithm: proof.algorithm,
      timestamp: proof.created,
      anchor: notarization["anchor_json"] ? JSON.parse(notarization["anchor_json"] as string) : null,
      // Note: signature math verified client-side via SDK for full trustlessness
      verifiedAt: new Date().toISOString(),
    });
  }

  // Try attestation
  const attestation = db.prepare("SELECT * FROM attestations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (attestation) {
    const proof = JSON.parse(attestation["proof_json"] as string);
    const now = new Date();
    const expired = attestation["expires_at"] ? new Date(attestation["expires_at"] as string) < now : false;
    return c.json({
      type: "attestation",
      id,
      issuer: attestation["issuer_id"],
      subject: attestation["subject_id"],
      claim: JSON.parse(attestation["claim_json"] as string),
      signer: proof.verificationMethod,
      algorithm: proof.algorithm,
      issuedAt: attestation["issued_at"],
      expiresAt: attestation["expires_at"] ?? null,
      expired,
      anchor: attestation["anchor_json"] ? JSON.parse(attestation["anchor_json"] as string) : null,
      verifiedAt: new Date().toISOString(),
    });
  }

  return c.json({ error: "Proof not found" }, 404);
});
