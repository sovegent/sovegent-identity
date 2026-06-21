import { describe, it, expect, beforeAll } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";
import { createAttestation, verifyAttestation } from "./attestation.js";
import type { SignerConfig } from "./types.js";

let signerConfig: SignerConfig;
let publicKey: string;

beforeAll(() => {
  const privKey = secp256k1.utils.randomPrivateKey();
  const pubKey = secp256k1.getPublicKey(privKey, true);
  publicKey = bytesToHex(pubKey);
  signerConfig = {
    privateKey: bytesToHex(privKey),
    algorithm: "secp256k1",
    verificationMethod: "0xIssuer",
  };
});

describe("createAttestation", () => {
  it("returns a properly shaped attestation", () => {
    const att = createAttestation(
      { issuer: "0xIssuer", subject: "0xSubject", claim: { isOver18: true } },
      signerConfig
    );
    expect(att.id).toMatch(/^urn:liberproof:attestation:/);
    expect(att.issuer).toBe("0xIssuer");
    expect(att.subject).toBe("0xSubject");
    expect(att.claim).toEqual({ isOver18: true });
    expect(att.proof).toBeDefined();
    expect(att.proof.algorithm).toBe("secp256k1");
  });

  it("includes expiry when provided", () => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const att = createAttestation(
      { issuer: "0xA", subject: "0xB", claim: {}, expiresAt },
      signerConfig
    );
    expect(att.expiresAt).toBe(expiresAt);
  });
});

describe("verifyAttestation", () => {
  it("returns valid=true for a freshly created attestation", () => {
    const att = createAttestation(
      { issuer: "0xIssuer", subject: "0xSubject", claim: { role: "member" } },
      signerConfig
    );
    const result = verifyAttestation(att, publicKey);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns valid=false for an expired attestation", () => {
    const att = createAttestation(
      {
        issuer: "0xIssuer",
        subject: "0xSubject",
        claim: {},
        expiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
      },
      signerConfig
    );
    const result = verifyAttestation(att, publicKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it("returns valid=false with wrong public key", () => {
    const att = createAttestation(
      { issuer: "0xIssuer", subject: "0xSubject", claim: {} },
      signerConfig
    );
    const wrongKey = bytesToHex(secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), true));
    const result = verifyAttestation(att, wrongKey);
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered claim (content not bound to signature)", () => {
    const att = createAttestation(
      { issuer: "0xIssuer", subject: "0xSubject", claim: { isOver18: false } },
      signerConfig
    );
    // Attacker flips the claim but keeps the original proof.
    const tampered = { ...att, claim: { isOver18: true } };
    const result = verifyAttestation(tampered, publicKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/content does not match/i);
  });

  it("rejects a tampered subject", () => {
    const att = createAttestation(
      { issuer: "0xIssuer", subject: "0xAlice", claim: { role: "admin" } },
      signerConfig
    );
    const tampered = { ...att, subject: "0xMallory" };
    const result = verifyAttestation(tampered, publicKey);
    expect(result.valid).toBe(false);
  });

  it("still verifies after a JSON round-trip (canonical, order-independent)", () => {
    const att = createAttestation(
      { issuer: "0xIssuer", subject: "0xSubject", claim: { b: 2, a: 1 } },
      signerConfig
    );
    const roundTripped = JSON.parse(JSON.stringify(att));
    expect(verifyAttestation(roundTripped, publicKey).valid).toBe(true);
  });
});
