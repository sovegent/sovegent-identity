import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { authRouter } from "./routes/auth.js";
import { notarizationsRouter } from "./routes/notarizations.js";
import { attestationsRouter } from "./routes/attestations.js";
import { verifyRouter } from "./routes/verify.js";
import { rateLimit } from "./middleware/rateLimit.js";

const app = new Hono();

// ── Global middleware ────────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (process.env["CORS_ORIGINS"] ?? "http://localhost:5173,http://localhost:5174").split(","),
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ── Global rate limit (300 req/min per IP) ───────────────────────────────────
app.use("*", rateLimit(300, 60_000));

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (c) =>
  c.json({ status: "ok", service: "sovegent-identity-api", version: "0.1.0" })
);

// ── Auth — stricter limit (20 attempts/min to prevent brute force) ───────────
app.use("/auth/*", rateLimit(20, 60_000));
app.route("/auth", authRouter);

// ── Proof routes ──────────────────────────────────────────────────────────────
app.route("/notarizations", notarizationsRouter);
app.route("/attestations", attestationsRouter);

// ── Public verify — moderate limit (60/min) ───────────────────────────────────
app.use("/verify/*", rateLimit(60, 60_000));
app.route("/verify", verifyRouter);

// ── Fallback ──────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(process.env["PORT"] ?? "3000");
const host = process.env["HOST"] ?? "0.0.0.0";

console.log(`🔐 Sovegent Identity API running on http://${host}:${port}`);
serve({ fetch: app.fetch, port, hostname: host });
