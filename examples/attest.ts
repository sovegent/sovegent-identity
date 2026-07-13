/**
 * Example: Issue an age attestation
 *
 * Run: npx tsx examples/attest.ts
 */
import { SovegentIdentity } from "@sovegent/sdk";

const issuer = new SovegentIdentity({
  signer: {
    privateKey: process.env.ISSUER_PRIVATE_KEY ?? "",
    algorithm: "secp256k1",
    verificationMethod: process.env.ISSUER_ADDRESS ?? "",
  },
});

const attestation = issuer.attest({
  subject: "0xSubjectWalletAddress",
  claim: { isOver18: true, country: "Liberland" },
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
});

console.log("Attestation:", JSON.stringify(attestation, null, 2));

// Verify it
const result = issuer.verify(attestation, process.env.ISSUER_PUBLIC_KEY ?? "");
console.log("Valid:", result.valid);
