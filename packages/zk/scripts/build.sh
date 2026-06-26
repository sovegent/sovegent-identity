#!/usr/bin/env bash
# Reproducible build for the LiberProof circuits: compile + (dev) Groth16 trusted setup.
# Self-sufficient — fetches the circom binary if it isn't on PATH. Needs node + `npm i`.
# Builds every circuit listed in CIRCUITS, sharing one powers-of-tau ceremony.
set -euo pipefail
cd "$(dirname "$0")/.."
ART="$PWD/artifacts"; BUILD="$PWD/build"
mkdir -p "$ART" "$BUILD"

# Circuit basenames (circuits/<name>.circom). Add new circuits here.
CIRCUITS=(ageProof rangeProof)

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

# Shared powers of tau (2^12 = 4096 constraints — ample for all current circuits).
echo "→ powers of tau"; $SJS powersoftau new bn128 12 "$BUILD/pot_0.ptau"
                        $SJS powersoftau contribute "$BUILD/pot_0.ptau" "$BUILD/pot_1.ptau" --name="liberproof dev" -e="$(head -c 64 /dev/urandom | base64)"
                        $SJS powersoftau prepare phase2 "$BUILD/pot_1.ptau" "$BUILD/pot_final.ptau"

for NAME in "${CIRCUITS[@]}"; do
  echo "=== $NAME ==="
  echo "→ compile";       "$CIRCOM" "circuits/$NAME.circom" -l node_modules --wasm --r1cs --sym -o "$BUILD"
  echo "→ groth16 keys";  $SJS groth16 setup "$BUILD/$NAME.r1cs" "$BUILD/pot_final.ptau" "$BUILD/${NAME}_0.zkey"
                          $SJS zkey contribute "$BUILD/${NAME}_0.zkey" "$ART/$NAME.zkey" --name="liberproof v1" -e="$(head -c 64 /dev/urandom | base64)"
                          $SJS zkey export verificationkey "$ART/$NAME.zkey" "$ART/$NAME.vkey.json"
                          cp "$BUILD/${NAME}_js/$NAME.wasm" "$ART/$NAME.wasm"
done
echo "✓ artifacts written to $ART (dev ceremony — see docs/zk/setup.md for production)"
