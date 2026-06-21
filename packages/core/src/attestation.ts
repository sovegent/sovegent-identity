import { randomBytes, bytesToHex } from "@noble/hashes/utils";
import { signPayload, verifySignature } from "./signer.js";
import { canonicalBytes, hashBytes } from "./hash.js";
import type { Attestation, SignerConfig, VerificationResult } from "./types.js";

export interface AttestationInput {
  issuer: string;
  subject: string;
  claim: Record<string, unknown>;
  expiresAt?: string;
}

/**
 * The exact set of fields that are signed, in a canonical form.
 * Single source of truth used by BOTH create and verify so the bytes can never
 * drift between them. Deliberately excludes `proof` (the signature itself) and
 * `anchor` (added after signing) — only the attested content is covered.
 */
function attestationPayload(a: {
  id: string;
  issuer: string;
  subject: string;
  claim: Record<string, unknown>;
  issuedAt: string;
  expiresAt?: string;
}): Uint8Array {
  return canonicalBytes({
    id: a.id,
    issuer: a.issuer,
    subject: a.subject,
    claim: a.claim,
    issuedAt: a.issuedAt,
    ...(a.expiresAt !== undefined && { expiresAt: a.expiresAt }),
  });
}

/** Create a signed attestation. */
export function createAttestation(
  input: AttestationInput,
  signer: SignerConfig
): Attestation {
  const id = `urn:liberproof:attestation:${bytesToHex(randomBytes(16))}`;
  const issuedAt = new Date().toISOString();
  const content = { id, ...input, issuedAt };
  return { ...content, proof: signPayload(attestationPayload(content), signer) };
}

/**
 * Verify an attestation's expiry, content integrity, and signature.
 *
 * Integrity is the critical step: we re-derive the payload hash from the
 * attestation's OWN fields and compare it to the hash the proof was made over.
 * Without this, tampering with `claim`/`subject` while keeping the original
 * proof would still verify as valid.
 */
export function verifyAttestation(
  attestation: Attestation,
  publicKey: string
): VerificationResult {
  const verifiedAt = new Date().toISOString();

  if (attestation.expiresAt && new Date(attestation.expiresAt) < new Date()) {
    return { valid: false, reason: "Attestation has expired", verifiedAt };
  }

  const expectedHash = hashBytes(attestationPayload(attestation));
  if (expectedHash !== attestation.proof.payloadHash) {
    return { valid: false, reason: "Content does not match signed hash", verifiedAt };
  }

  const valid = verifySignature(attestation.proof, publicKey);
  return valid ? { valid: true, verifiedAt } : { valid: false, reason: "Invalid signature", verifiedAt };
}
