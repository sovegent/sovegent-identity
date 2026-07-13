# @sovegent/zk

Zero-knowledge proof generation and verification for Sovegent Identity.

## What's in here

- **`generateProof`** — generate a ZK proof from a witness + compiled circuit
- **`verifyProof`** — verify a proof against a verification key
- **`circuits/ageProof.circom`** — prove age >= minAge without revealing actual age

## Install

```bash
pnpm add @sovegent/zk snarkjs
```

`snarkjs` is a required peer dependency.

## Compile the age circuit

See [docs/zk/setup.md](../../docs/zk/setup.md) for full setup instructions.

```bash
npm install            # circomlib + snarkjs
npm run build:circuit  # compile + dev trusted setup -> artifacts/
```

## Usage

```ts
import { generateProof, verifyProof } from "@sovegent/zk";

const proof = await generateProof({
  witness: { age: 25, minAge: 18 },
  wasmPath: "./build/ageProof_js/ageProof.wasm",
  zkeyPath: "./circuits/ageProof_final.zkey",
});

// publicSignals: ["1"] — age >= 18 proved without revealing 25
```

## License

AGPL-3.0-or-later — see [LICENSE](../../LICENSE)
