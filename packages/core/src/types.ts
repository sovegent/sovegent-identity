/**
 * Sovegent Identity Core Types
 * W3C Verifiable Credentials aligned
 */

export interface SignerConfig {
  privateKey: string;
  algorithm: ProofAlgorithm;
  verificationMethod: string;
}

export type ProofAlgorithm = "Ed25519" | "secp256k1" | "secp256r1";

export interface ProofMetadata {
  /** ISO 8601 timestamp */
  created: string;
  /** DID or wallet address of the signer */
  verificationMethod: string;
  /** Signing algorithm used */
  algorithm: ProofAlgorithm;
}

export interface SignedProof extends ProofMetadata {
  /** Hex-encoded signature */
  signature: string;
  /** Hex-encoded SHA-256 hash of the payload */
  payloadHash: string;
}

/** W3C Verifiable Credential (simplified) */
export interface VerifiableCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, unknown>;
  proof?: SignedProof;
}

/** Notarization record — document hash + timestamp + optional anchor */
export interface NotarizationRecord {
  id: string;
  /** SHA-256 hash of the document bytes, hex encoded */
  documentHash: string;
  /** MIME type of the original document */
  mimeType: string;
  /** ISO 8601 timestamp of notarization */
  timestamp: string;
  /** Optional human-readable label */
  label?: string;
  /** Cryptographic proof of the notarization event */
  proof: SignedProof;
  /** On-chain anchor info if submitted */
  anchor?: ChainAnchor;
}

/** Attestation — a signed claim about a subject */
export interface Attestation {
  id: string;
  issuer: string;
  subject: string;
  claim: Record<string, unknown>;
  issuedAt: string;
  expiresAt?: string;
  proof: SignedProof;
  anchor?: ChainAnchor;
}

/** On-chain anchor record */
export interface ChainAnchor {
  chain: string;
  txHash: string;
  blockNumber?: number;
  anchoredAt: string;
}

/** Result of any verification operation */
export interface VerificationResult {
  valid: boolean;
  reason?: string;
  verifiedAt: string;
  details?: Record<string, unknown>;
}
