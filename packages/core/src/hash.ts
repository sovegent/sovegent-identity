import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

/** Hash bytes with SHA-256. Returns lowercase hex. */
export function hashBytes(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}

/** Hash a UTF-8 string with SHA-256. */
export function hashString(data: string): string {
  return hashBytes(new TextEncoder().encode(data));
}

/** Hash a JSON-serializable object deterministically (keys sorted). */
export function hashObject(obj: Record<string, unknown>): string {
  return hashString(JSON.stringify(sortKeys(obj)));
}

/**
 * Canonical (deterministic, key-sorted) UTF-8 byte serialization of a JSON value.
 * Use this for any payload that must be re-derived and hash-compared later
 * (e.g. attestation / notarization verification) so key ordering can't change the bytes.
 */
export function canonicalBytes(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(sortKeys(obj)));
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.keys(obj as object)
        .sort()
        .map((k) => [k, sortKeys((obj as Record<string, unknown>)[k])])
    );
  }
  return obj;
}
