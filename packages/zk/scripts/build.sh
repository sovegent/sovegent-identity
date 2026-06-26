#!/usr/bin/env bash
# Reproducible build for the AgeProof circuit: compile + (dev) Groth16 trusted setup.
# Self-sufficient — fetches the circom binary if it isn't on PATH. Needs node + `npm i`.
set -euo pipefail
cd "$(dirname "$0")/.."
ART="$PWD/artifacts"; BUILD="$PWD/build"
mkdir -p "$ART" "$BUILD"

CIRCOM="circom"
if ! command -v circom >/dev/null 2>&1; then
  CIRCOM="$BUILD/circom"
  if [ ! -x "$CIRCOM" ]; then
    echo "→ fetching circom 2.1.9"
    curl -fsSL -o "$CIRCOM" https://github.com/iden3/circom/releases/download/v2.1.9/circom-linux-amd64
    chmod +x "$CIRCOM"
  fi
fi
SJS="npx --yes snarkjs@0.7"

echo "→ compile";       "$CIRCOM" circuits/ageProof.circom -l node_modules --wasm --r1cs --sym -o "$BUILD"
echo "→ powers of tau"; $SJS powersoftau new bn128 12 "$BUILD/pot_0.ptau"
                        $SJS powersoftau contribute "$BUILD/pot_0.ptau" "$BUILD/pot_1.ptau" --name="liberproof dev" -e="$(head -c 64 /dev/urandom | base64)"
                        $SJS powersoftau prepare phase2 "$BUILD/pot_1.ptau" "$BUILD/pot_final.ptau"
echo "→ groth16 keys";  $SJS groth16 setup "$BUILD/ageProof.r1cs" "$BUILD/pot_final.ptau" "$BUILD/age_0.zkey"
                        $SJS zkey contribute "$BUILD/age_0.zkey" "$ART/ageProof.zkey" --name="liberproof v1" -e="$(head -c 64 /dev/urandom | base64)"
                        $SJS zkey export verificationkey "$ART/ageProof.zkey" "$ART/ageProof.vkey.json"
                        cp "$BUILD/ageProof_js/ageProof.wasm" "$ART/ageProof.wasm"
echo "✓ artifacts written to $ART (dev ceremony — see docs/zk/setup.md for production)"
