import { randomBytes, bytesToHex } from "@noble/hashes/utils";
import { canonicalBytes, hashBytes } from "./hash.js";
import { signPayload, verifySignature } from "./signer.js";
import type { NotarizationRecord, SignerConfig, VerificationResult } from "./types.js";

export interface NotarizationInput {
  data: Uint8Array;
  mimeType: string;
  label?: string;
}

/**
 * The exact set of fields that are signed, in canonical form. Single source of
 * truth for both create and verify. Excludes `proof` and any post-signing `anchor`.
 */
function notarizationPayload(r: {
  id: string;
  documentHash: string;
  mimeType: string;
  timestamp: string;
  label?: string;
}): Uint8Array {
  return canonicalBytes({
    id: r.id,
    documentHash: r.documentHash,
    mimeType: r.mimeType,
    timestamp: r.timestamp,
    ...(r.label !== undefined && { label: r.label }),
  });
}

/**
 * Notarize a document — hash it, timestamp it, sign it.
 * Chain anchoring is handled by the @liberproof/anchors package.
 */
export function notarizeDocument(
  input: NotarizationInput,
  signer: SignerConfig
): NotarizationRecord {
  const id = `urn:liberproof:notarization:${bytesToHex(randomBytes(16))}`;
  const documentHash = hashBytes(input.data);
  const timestamp = new Date().toISOString();
  const content = {
    id,
    documentHash,
    mimeType: input.mimeType,
    timestamp,
    ...(input.label !== undefined && { label: input.label }),
  };
  return { ...content, proof: signPayload(notarizationPayload(content), signer) };
}

/**
 * Verify a notarization record's content integrity and signature.
 *
 * If `originalData` is supplied, we also confirm it hashes to the recorded
 * `documentHash` — i.e. that this record actually notarizes *that* document.
 * Either way, we re-derive the signed payload hash from the record's own fields
 * and require it to match the proof, so tampering is rejected.
 */
export function verifyNotarization(
  record: NotarizationRecord,
  publicKey: string,
  originalData?: Uint8Array
): VerificationResult {
  const verifiedAt = new Date().toISOString();

  if (originalData && hashBytes(originalData) !== record.documentHash) {
    return { valid: false, reason: "Document does not match documentHash", verifiedAt };
  }

  const expectedHash = hashBytes(notarizationPayload(record));
  if (expectedHash !== record.proof.payloadHash) {
    return { valid: false, reason: "Content does not match signed hash", verifiedAt };
  }

  const valid = verifySignature(record.proof, publicKey);
  return valid ? { valid: true, verifiedAt } : { valid: false, reason: "Invalid signature", verifiedAt };
}
