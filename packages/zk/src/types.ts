/** A generated ZK proof */
export interface ZKProof {
  protocol: "groth16" | "plonk";
  proof: unknown;
  publicSignals: string[];
}

/** Input for proving a claim without revealing the witness */
export interface ZKClaimInput {
  /** The private witness values (NOT sent on-chain) */
  witness: Record<string, string | number>;
  /** Path to the compiled .wasm circuit */
  wasmPath: string;
  /** Path to the proving key (.zkey) */
  zkeyPath: string;
}
