/**
 * ZK proof generation & verification (Groth16).
 *
 * The circuit is compiled and its keys generated separately — see
 * `scripts/build.sh` and `docs/zk/setup.md`. snarkjs is a peer dependency,
 * imported lazily because it is only needed at proof time.
 */
import type { ZKClaimInput, ZKProof } from "./types.js";

/** A verification key: the parsed object, an http(s) URL, or a local file path. */
export type VerificationKeySource = string | Record<string, unknown>;

async function loadSnarkjs() {
  // @ts-ignore — optional peer dep; types are not required at build time.
  return import("snarkjs").catch(() => {
    throw new Error("snarkjs not installed. Run `npm i snarkjs` in @liberproof/zk.");
  });
}

/** Generate a Groth16 proof from a private witness + compiled circuit + proving key. */
export async function generateProof(input: ZKClaimInput): Promise<ZKProof> {
  const snarkjs = await loadSnarkjs();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input.witness,
    input.wasmPath,
    input.zkeyPath,
  );
  return { protocol: "groth16", proof, publicSignals };
}

/** Verify a Groth16 proof against a verification key. */
export async function verifyProof(
  zkProof: ZKProof,
  vkey: VerificationKeySource,
): Promise<boolean> {
  const snarkjs = await loadSnarkjs();
  const key = await resolveVkey(vkey);
  return snarkjs.groth16.verify(key, zkProof.publicSignals, zkProof.proof);
}

/** Resolve a verification key from an object, an http(s) URL (browser), or a file path (Node). */
async function resolveVkey(src: VerificationKeySource): Promise<Record<string, unknown>> {
  if (typeof src !== "string") return src;
  if (/^https?:\/\//.test(src)) return fetch(src).then((r) => r.json());
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(src, "utf8"));
}
