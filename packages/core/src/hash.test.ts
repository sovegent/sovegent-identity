import { describe, it, expect } from "vitest";
import { hashBytes, hashString, hashObject } from "./hash.js";

describe("hashBytes", () => {
  it("produces a 64-char lowercase hex string", () => {
    const result = hashBytes(new Uint8Array([1, 2, 3]));
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    const a = hashBytes(new TextEncoder().encode("hello"));
    const b = hashBytes(new TextEncoder().encode("hello"));
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashBytes(new TextEncoder().encode("foo"))).not.toBe(
      hashBytes(new TextEncoder().encode("bar"))
    );
  });

  it("matches known SHA-256 of empty input", () => {
    expect(hashBytes(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});

describe("hashString", () => {
  it("matches known SHA-256 of 'abc'", () => {
    expect(hashString("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("hashObject", () => {
  it("sorts keys deterministically", () => {
    const a = hashObject({ b: 2, a: 1 });
    const b = hashObject({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("produces different hashes for different values", () => {
    expect(hashObject({ a: 1 })).not.toBe(hashObject({ a: 2 }));
  });
});
