# @sovegent/core

Core cryptographic primitives for the Sovegent Identity ecosystem.

## What's in here

- **Hashing** — SHA-256 via `@noble/hashes` (`hashBytes`, `hashString`, `hashObject`)
- **Signing** — secp256k1 and Ed25519 via `@noble/curves` (`signPayload`, `verifySignature`)
- **Attestations** — create and verify signed W3C-aligned claims (`createAttestation`, `verifyAttestation`)
- **Notarization** — hash + sign + timestamp any document (`notarizeDocument`)
- **Types** — `VerifiableCredential`, `Attestation`, `NotarizationRecord`, `ChainAnchor`, `VerificationResult`

## Install

```bash
pnpm add @sovegent/core
```

## Usage

```ts
import { notarizeDocument, createAttestation, verifyAttestation } from "@sovegent/core";

const signer = {
  privateKey: "0xabc...",
  algorithm: "secp256k1",
  verificationMethod: "0xYourAddress",
};

// Notarize a document
const record = notarizeDocument({ data: fileBytes, mimeType: "application/pdf" }, signer);

// Issue an attestation
const att = createAttestation({ issuer: "0xA", subject: "0xB", claim: { isOver18: true } }, signer);

// Verify it
const result = verifyAttestation(att, issuerPublicKey);
console.log(result.valid); // true
```

## Design

- **Offline-first** — no network calls, works in Node.js and the browser
- **Noble crypto only** — audited, zero-dependency cryptographic primitives
- **W3C VC aligned** — compatible with the Verifiable Credentials Data Model

## License

AGPL-3.0-or-later — see [LICENSE](../../LICENSE)
