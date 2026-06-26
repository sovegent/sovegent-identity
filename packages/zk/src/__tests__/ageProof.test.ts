import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { generateProof, verifyProof } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const art = (f: string) => resolve(here, "../../artifacts", f);
const wasmPath = art("ageProof.wasm");
const zkeyPath = art("ageProof.zkey");
const vkeyPath = art("ageProof.vkey.json");

describe("AgeProof (Groth16)", () => {
  it("proves age >= minAge without revealing the age, and verifies", async () => {
    const proof = await generateProof({ witness: { age: 25, minAge: 18 }, wasmPath, zkeyPath });
    expect(proof.publicSignals).toEqual(["1", "18"]); // [valid, minAge]
    expect(await verifyProof(proof, vkeyPath)).toBe(true);
  });

  it("rejects a proof reused against a different public claim (tamper)", async () => {
    const proof = await generateProof({ witness: { age: 25, minAge: 18 }, wasmPath, zkeyPath });
    expect(await verifyProof({ ...proof, publicSignals: ["1", "21"] }, vkeyPath)).toBe(false);
  });

  it("cannot prove a false statement (age 16 < threshold 18)", async () => {
    await expect(
      generateProof({ witness: { age: 16, minAge: 18 }, wasmPath, zkeyPath }),
    ).rejects.toThrow();
  });
});
