import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { generateProof, verifyProof } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const art = (f: string) => resolve(here, "../../artifacts", f);
const wasmPath = art("rangeProof.wasm");
const zkeyPath = art("rangeProof.zkey");
const vkeyPath = art("rangeProof.vkey.json");

describe("RangeProof (Groth16)", () => {
  it("proves min <= value <= max without revealing the value, and verifies", async () => {
    const proof = await generateProof({
      witness: { value: 50000, min: 30000, max: 80000 },
      wasmPath,
      zkeyPath,
    });
    expect(proof.publicSignals).toEqual(["1", "30000", "80000"]); // [valid, min, max]
    expect(await verifyProof(proof, vkeyPath)).toBe(true);
  });

  it("rejects a proof reused against a different public claim (tamper)", async () => {
    const proof = await generateProof({
      witness: { value: 50000, min: 30000, max: 80000 },
      wasmPath,
      zkeyPath,
    });
    expect(await verifyProof({ ...proof, publicSignals: ["1", "40000", "80000"] }, vkeyPath)).toBe(false);
  });

  it("cannot prove a false statement (value 90000 outside [30000, 80000])", async () => {
    await expect(
      generateProof({ witness: { value: 90000, min: 30000, max: 80000 }, wasmPath, zkeyPath }),
    ).rejects.toThrow();
  });
});
