/**
 * SIWE — Sign-In with Ethereum
 * Wallet signs a challenge message → API returns a JWT.
 * Compatible with Sovegent Wallet (secp256k1) and any EIP-4361 wallet.
 */
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, bytesToHex } from "@noble/hashes/utils";
import { verifyMessage } from "viem";

const JWT_SECRET = new TextEncoder().encode(
  process.env["JWT_SECRET"] ?? "dev-secret-change-in-production"
);

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Generate a one-time nonce for SIWE challenge */
export function generateNonce(): string {
  return bytesToHex(randomBytes(16));
}

/** Build the SIWE message the wallet must sign */
export function buildSiweMessage(params: {
  address: string;
  nonce: string;
  domain?: string;
}): string {
  const domain = params.domain ?? "identity.sovegent.com";
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    "Sign in to Sovegent Identity — no password required.",
    "",
    `URI: https://${domain}`,
    "Version: 1",
    `Nonce: ${params.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

/** Verify a SIWE signature and return the signer address */
export async function verifySiweSignature(params: {
  message: string;
  signature: `0x${string}`;
  expectedAddress: string;
}): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: params.expectedAddress as `0x${string}`,
      message: params.message,
      signature: params.signature,
    });
    return valid;
  } catch {
    return false;
  }
}

/** Issue a JWT for an authenticated wallet address */
export async function issueJwt(address: string): Promise<string> {
  return new SignJWT({ sub: address, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

/** Verify and decode a JWT. Returns the wallet address or null. */
export async function verifyJwt(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload["sub"] === "string" ? payload["sub"] : null;
  } catch {
    return null;
  }
}
