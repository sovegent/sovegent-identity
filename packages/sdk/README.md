# @sovegent/sdk

The unified Sovegent Identity SDK. Everything in one import.

## Install

```bash
pnpm add @sovegent/sdk
```

## Quick Start

```ts
import { SovegentIdentity } from "@sovegent/sdk";

const lp = new SovegentIdentity({
  signer: {
    privateKey: "0xabc...",
    algorithm: "secp256k1",
    verificationMethod: "0xYourWalletAddress",
  },
});

// Notarize a document
const record = lp.notarize({ data: fileBytes, mimeType: "application/pdf", label: "Contract" });
console.log(record.documentHash); // SHA-256 hex
console.log(record.proof);        // cryptographic proof

// Issue an attestation
const attestation = lp.attest({
  subject: "0xSubjectAddress",
  claim: { isOver18: true },
  expiresAt: "2027-01-01T00:00:00Z",
});

// Verify it
const result = lp.verify(attestation, issuerPublicKey);
console.log(result.valid); // true

// Anchor on-chain
import { EvmAnchorAdapter } from "@sovegent/sdk";
const anchored = await lp.anchor(record, new EvmAnchorAdapter({ ... }));
```

## What's included

Re-exports everything from:
- `@sovegent/core` — hashing, signing, types, attestations, notarization
- `@sovegent/anchors` — EVM and Liberland anchor adapters
- `@sovegent/zk` — ZK proof types (generation requires `snarkjs`)

## License

AGPL-3.0-or-later — see [LICENSE](../../LICENSE)
