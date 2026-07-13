import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { hashBytes } from "./hash.js";
import type { SignedProof, SignerConfig } from "./types.js";


/** Sign a payload and return a SignedProof. */
export function signPayload(
  payload: Uint8Array,
  config: SignerConfig
): SignedProof {
  const payloadHash = hashBytes(payload);
  const hashBuf = hexToBytes(payloadHash);
  const privKey = hexToBytes(config.privateKey);

  let signature: string;
  if (config.algorithm === "secp256k1") {
    signature = bytesToHex(secp256k1.sign(hashBuf, privKey).toCompactRawBytes());
  } else if (config.algorithm === "Ed25519") {
    signature = bytesToHex(ed25519.sign(hashBuf, privKey));
  } else {
    throw new Error(`Unsupported algorithm: ${config.algorithm}`);
  }

  return {
    created: new Date().toISOString(),
    verificationMethod: config.verificationMethod,
    algorithm: config.algorithm,
    signature,
    payloadHash,
  };
}

/** Verify a SignedProof against a public key. */
export function verifySignature(proof: SignedProof, publicKey: string): boolean {
  try {
    const hashBuf = hexToBytes(proof.payloadHash);
    const sig = hexToBytes(proof.signature);
    const pubKey = hexToBytes(publicKey);
    if (proof.algorithm === "secp256k1") return secp256k1.verify(sig, hashBuf, pubKey);
    if (proof.algorithm === "Ed25519") return ed25519.verify(sig, hashBuf, pubKey);
    return false;
  } catch {
    return false;
  }
}
