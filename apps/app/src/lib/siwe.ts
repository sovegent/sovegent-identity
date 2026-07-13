/**
 * SIWE — Sign-In with Ethereum
 * Uses wallet.ts for all provider interaction.
 */
import { apiPost } from "./api.js";
import { personalSign } from "./wallet.js";

export async function signInWithWallet(address: string): Promise<string> {
  // 1. Get nonce + pre-built message from API
  const { message } = await apiPost<{ nonce: string; message: string }>(
    "/auth/nonce",
    { address }
  );

  // 2. Sign via wallet bridge (supports Sovegent Wallet extended signing + standard EIP-191)
  const signature = await personalSign(message, address);

  // 3. Exchange signature for JWT
  const { token } = await apiPost<{ token: string }>(
    "/auth/verify",
    { address, signature, message }
  );

  localStorage.setItem("sovegent_token", token);
  localStorage.setItem("sovegent_address", address.toLowerCase());
  return token;
}

export function getStoredAddress(): string | null {
  return localStorage.getItem("sovegent_address");
}

export function signOut(): void {
  localStorage.removeItem("sovegent_token");
  localStorage.removeItem("sovegent_address");
}
