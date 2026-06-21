/**
 * LiberProof — unified SDK entry point
 *
 * Usage:
 *   import { LiberProof } from "@liberproof/sdk";
 *
 *   const lp = new LiberProof({
 *     signer: {
 *       privateKey: "0xabc...",
 *       algorithm: "secp256k1",
 *       verificationMethod: "did:key:z6Mk...",
 *     }
 *   });
 *
 *   // Notarize a document
 *   const record = await lp.notarize({ data: fileBytes, mimeType: "application/pdf", label: "Contract" });
 *
 *   // Create an attestation
 *   const attestation = await lp.attest({
 *     subject: "0xwallet...",
 *     claim: { isOver18: true }
 *   });
 *
 *   // Optionally anchor on-chain
 *   await lp.anchor(record, evmAdapter);
 */

import {
  createAttestation,
  verifyAttestation,
  notarizeDocument,
  verifyNotarization as verifyNotarizationCore,
  type SignerConfig,
  type AttestationInput,
  type NotarizationInput,
  type NotarizationRecord,
  type Attestation,
  type VerificationResult,
} from "@liberproof/core";
import type { AnchorAdapter } from "@liberproof/anchors";

export interface LiberProofConfig {
  signer: SignerConfig;
}

export class LiberProof {
  private signer: SignerConfig;

  constructor(config: LiberProofConfig) {
    this.signer = config.signer;
  }

  /** Notarize a document. Returns a signed NotarizationRecord. */
  notarize(input: NotarizationInput): NotarizationRecord {
    return notarizeDocument(input, this.signer);
  }

  /** Create a signed attestation. */
  attest(input: Omit<AttestationInput, "issuer">): Attestation {
    return createAttestation(
      { ...input, issuer: this.signer.verificationMethod },
      this.signer
    );
  }

  /** Verify an attestation against a public key. */
  verify(attestation: Attestation, publicKey: string): VerificationResult {
    return verifyAttestation(attestation, publicKey);
  }

  /**
   * Verify a notarization record against a public key.
   * Pass `originalData` to also confirm the document bytes match the recorded hash.
   */
  verifyNotarization(
    record: NotarizationRecord,
    publicKey: string,
    originalData?: Uint8Array
  ): VerificationResult {
    return verifyNotarizationCore(record, publicKey, originalData);
  }

  /**
   * Anchor a proof on-chain using the provided adapter.
   * Works with any AnchorAdapter — EVM, Liberland, etc.
   */
  async anchor<T extends NotarizationRecord | Attestation>(
    record: T,
    adapter: AnchorAdapter
  ): Promise<T> {
    const anchor = await adapter.anchor(record.proof.payloadHash);
    return { ...record, anchor };
  }
}
