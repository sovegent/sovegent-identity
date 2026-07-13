/**
 * Auth route integration tests
 * Uses an in-memory SQLite DB — no external deps needed.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { authRouter } from "../routes/auth.js";
import { getDb, closeDb } from "../db/index.js";

// Use a test DB path
process.env["DB_PATH"] = ":memory:";

const app = new Hono().route("/auth", authRouter);

async function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) init.body = JSON.stringify(body);
  const res = await app.fetch(new Request(`http://localhost${path}`, init));
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

afterAll(() => closeDb());

describe("POST /auth/nonce", () => {
  it("returns a nonce and message for a valid address", async () => {
    const { status, body } = await req("POST", "/auth/nonce", {
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    });
    expect(status).toBe(200);
    expect(typeof body["nonce"]).toBe("string");
    expect((body["nonce"] as string).length).toBe(32); // 16 bytes hex
    expect(body["message"]).toContain("Sovegent Identity");
    expect(body["message"]).toContain(body["nonce"]);
  });

  it("returns 400 for missing address", async () => {
    const { status } = await req("POST", "/auth/nonce", {});
    expect(status).toBe(400);
  });

  it("returns 400 for too-short address", async () => {
    const { status } = await req("POST", "/auth/nonce", { address: "0x1" });
    expect(status).toBe(400);
  });
});

describe("GET /auth/me", () => {
  it("returns 401 without token", async () => {
    const res = await app.fetch(new Request("http://localhost/auth/me"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with malformed token", async () => {
    const res = await app.fetch(
      new Request("http://localhost/auth/me", {
        headers: { Authorization: "Bearer not-a-real-jwt" },
      })
    );
    expect(res.status).toBe(401);
  });
});
