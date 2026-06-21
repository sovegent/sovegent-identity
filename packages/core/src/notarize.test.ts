import { describe, it, expect, beforeAll } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";
import { notarizeDocument, verifyNotarization } from "./notarize.js";
import { hashBytes } from "./hash.js";
import type { SignerConfig } from "./types.js";

let signerConfig: SignerConfig;
let publicKey: string;

beforeAll(() => {
  const privKey = secp256k1.utils.randomPrivateKey();
  publicKey = bytesToHex(secp256k1.getPublicKey(privKey, true));
  signerConfig = {
    privateKey: bytesToHex(privKey),
    algorithm: "secp256k1",
    verificationMethod: "0xNotary",
  };
});

describe("notarizeDocument", () => {
  it("returns a record with correct documentHash", () => {
    const data = new TextEncoder().encode("important contract text");
    const record = notarizeDocument({ data, mimeType: "text/plain", label: "Test" }, signerConfig);

    expect(record.documentHash).toBe(hashBytes(data));
    expect(record.id).toMatch(/^urn:liberproof:notarization:/);
    expect(record.mimeType).toBe("text/plain");
    expect(record.label).toBe("Test");
    expect(record.proof).toBeDefined();
    expect(record.anchor).toBeUndefined();
  });

  it("generates unique IDs for the same document", () => {
    const data = new TextEncoder().encode("same content");
    const r1 = notarizeDocument({ data, mimeType: "text/plain" }, signerConfig);
    const r2 = notarizeDocument({ data, mimeType: "text/plain" }, signerConfig);
    expect(r1.id).not.toBe(r2.id);
  });

  it("has a recent timestamp", () => {
    const data = new TextEncoder().encode("ts test");
    const before = Date.now();
    const record = notarizeDocument({ data, mimeType: "text/plain" }, signerConfig);
    const after = Date.now();
    const ts = new Date(record.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe("verifyNotarization", () => {
  const data = new TextEncoder().encode("notarized document body");

  it("verifies a fresh record", () => {
    const record = notarizeDocument({ data, mimeType: "text/plain", label: "Doc" }, signerConfig);
    expect(verifyNotarization(record, publicKey).valid).toBe(true);
  });

  it("confirms the original document bytes against documentHash", () => {
    const record = notarizeDocument({ data, mimeType: "text/plain" }, signerConfig);
    expect(verifyNotarization(record, publicKey, data).valid).toBe(true);
    const wrongDoc = new TextEncoder().encode("a different document");
    const res = verifyNotarization(record, publicKey, wrongDoc);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/document does not match/i);
  });

  it("rejects a tampered documentHash (content not bound to signature)", () => {
    const record = notarizeDocument({ data, mimeType: "text/plain" }, signerConfig);
    const tampered = { ...record, documentHash: hashBytes(new TextEncoder().encode("forged")) };
    const res = verifyNotarization(tampered, publicKey);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/content does not match/i);
  });

  it("rejects a wrong public key", () => {
    const record = notarizeDocument({ data, mimeType: "text/plain" }, signerConfig);
    const wrongKey = bytesToHex(secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), true));
    expect(verifyNotarization(record, wrongKey).valid).toBe(false);
  });
});
