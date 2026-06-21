/**
 * Notarization route integration tests
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { notarizationsRouter } from "../routes/notarizations.js";
import { issueJwt } from "../lib/auth.js";
import { getDb, closeDb } from "../db/index.js";

process.env["DB_PATH"] = ":memory:";
process.env["JWT_SECRET"] = "test-secret-for-vitest-only";

const app = new Hono().route("/notarizations", notarizationsRouter);

let token: string;
const testAddress = "0xtest000000000000000000000000000000000001";

beforeAll(async () => {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO users (id) VALUES (?)").run(testAddress);
  token = await issueJwt(testAddress);
});

afterAll(() => closeDb());

async function authedPost(path: string, body: unknown) {
  const res = await app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

async function authedGet(path: string) {
  const res = await app.fetch(
    new Request(`http://localhost${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

const validPayload = {
  documentHash: "a".repeat(64),
  mimeType: "application/pdf",
  label: "Test Document",
  proofJson: JSON.stringify({ payloadHash: "a".repeat(64), created: new Date().toISOString() }),
};

describe("POST /notarizations", () => {
  it("creates a notarization and returns 201", async () => {
    const { status, body } = await authedPost("/notarizations", validPayload);
    expect(status).toBe(201);
    expect(body["id"]).toMatch(/^urn:liberproof:notarization:/);
    expect(body["documentHash"]).toBe(validPayload.documentHash);
    expect(body["label"]).toBe("Test Document");
    expect(body["anchor"]).toBeNull();
  });

  it("returns 401 without auth", async () => {
    const res = await app.fetch(
      new Request("http://localhost/notarizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid document hash length", async () => {
    const { status } = await authedPost("/notarizations", {
      ...validPayload,
      documentHash: "tooshort",
    });
    expect(status).toBe(400);
  });
});

describe("GET /notarizations/:id", () => {
  it("returns a notarization by ID (public)", async () => {
    const { body: created } = await authedPost("/notarizations", validPayload);
    const id = created["id"] as string;

    const res = await app.fetch(
      new Request(`http://localhost/notarizations/${encodeURIComponent(id)}`)
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body["id"]).toBe(id);
  });

  it("returns 404 for unknown ID", async () => {
    const res = await app.fetch(
      new Request("http://localhost/notarizations/urn:liberproof:notarization:doesnotexist")
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /notarizations/:id/anchor", () => {
  it("records an on-chain anchor", async () => {
    const { body: created } = await authedPost("/notarizations", validPayload);
    const id = created["id"] as string;

    const { status, body } = await authedPost(
      `/notarizations/${encodeURIComponent(id)}/anchor`,
      { chain: "liberland", txHash: "0xdeadbeef123", blockNumber: 42 }
    );
    expect(status).toBe(200);
    expect(body["anchor"]).toMatchObject({ chain: "liberland", txHash: "0xdeadbeef123" });
  });

  it("returns 409 if already anchored", async () => {
    const { body: created } = await authedPost("/notarizations", validPayload);
    const id = created["id"] as string;
    // txHash must satisfy the route's min(10) validation, else the first anchor
    // 400s and the row is never anchored — masking the 409 path under test.
    const anchorPayload = { chain: "ethereum", txHash: "0xabc1234567" };

    const first = await authedPost(`/notarizations/${encodeURIComponent(id)}/anchor`, anchorPayload);
    expect(first.status).toBe(200);
    const { status } = await authedPost(`/notarizations/${encodeURIComponent(id)}/anchor`, anchorPayload);
    expect(status).toBe(409);
  });
});
