# ZK Circuit Setup

LiberProof's zero-knowledge layer uses circom 2.x circuits compiled to WASM,
with snarkjs as the Groth16 prover/verifier. Proofs are generated client-side
(browser or Node) — the witness never leaves the prover.

The artifacts in `packages/zk/artifacts/` are committed and ready to use; this
guide is for rebuilding them.

## Prerequisites

```bash
# circom 2.x — prebuilt binary, no Rust toolchain needed:
curl -fsSL -o circom \
  https://github.com/iden3/circom/releases/download/v2.1.9/circom-linux-amd64
chmod +x circom && sudo mv circom /usr/local/bin/

# circuit library (circomlib) + prover (snarkjs):
npm install         # in packages/zk
```

## Build

```bash
npm run build:circuit      # packages/zk/scripts/build.sh
```

Compiles the circuit and runs a development Groth16 trusted setup, writing
`ageProof.{wasm,zkey}` + `ageProof.vkey.json` into `artifacts/`. Equivalent to:

```bash
mkdir -p build
circom circuits/ageProof.circom -l node_modules --wasm --r1cs --sym -o build/
snarkjs powersoftau new bn128 12 build/pot_0.ptau
snarkjs powersoftau contribute build/pot_0.ptau build/pot_1.ptau --name="liberproof dev"
snarkjs powersoftau prepare phase2 build/pot_1.ptau build/pot_final.ptau
snarkjs groth16 setup build/ageProof.r1cs build/pot_final.ptau build/age_0.zkey
snarkjs zkey contribute build/age_0.zkey artifacts/ageProof.zkey --name="liberproof v1"
snarkjs zkey export verificationkey artifacts/ageProof.zkey artifacts/ageProof.vkey.json
cp build/ageProof_js/ageProof.wasm artifacts/ageProof.wasm
```

## Generate & verify a proof

```ts
import { generateProof, verifyProof } from "@liberproof/zk";

const proof = await generateProof({
  witness: { age: 25, minAge: 18 },   // age is private — never leaves the prover
  wasmPath: "artifacts/ageProof.wasm",
  zkeyPath: "artifacts/ageProof.zkey",
});
// proof.publicSignals === ["1", "18"]  → [valid, minAge]; age >= minAge proved

const ok = await verifyProof(proof, "artifacts/ageProof.vkey.json"); // true
```

`verifyProof` accepts the key as a parsed object, an http(s) URL (browser), or a
local file path (Node / CLI).

## Production setup ⚠️

The committed keys come from a **single-contributor** ceremony — fine for
development, tests, and demos, but production must replace the proving key with
the output of a **multi-party trusted-setup ceremony** (so no single party holds
the toxic waste). Until then, ZK selective-disclosure is alpha.
