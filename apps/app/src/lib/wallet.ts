/**
 * Wallet Provider Bridge
 *
 * Abstracts over:
 *   - Sovegent Wallet browser extension (window.sovegent + window.ethereum)
 *   - MetaMask / any EIP-1193 wallet (window.ethereum)
 *   - No wallet (graceful degradation)
 *
 * Sovegent Wallet injects window.sovegent with extended capabilities
 * beyond the standard EIP-1193 interface (e.g. direct SDK signing).
 */

export type WalletType = "sovegent-wallet" | "metamask" | "eip1193" | "none";

export interface WalletInfo {
  type: WalletType;
  address: string | null;
  isConnected: boolean;
}

/** Detect which wallet is available */
export function detectWallet(): WalletType {
  if (typeof window === "undefined") return "none";

  const win = window as any;

  // Sovegent Wallet injects a specific identifier
  if (win.sovegent?.isSovegentWallet) return "sovegent-wallet";

  // MetaMask injects window.ethereum with isMetaMask
  if (win.ethereum?.isMetaMask) return "metamask";

  // Generic EIP-1193 provider
  if (win.ethereum) return "eip1193";

  return "none";
}

/** Get the EIP-1193 provider */
function getProvider(): any {
  const win = window as any;
  return win.ethereum ?? null;
}

/** Request wallet connection and return the first account */
export async function connectWallet(): Promise<string> {
  const walletType = detectWallet();

  if (walletType === "none") {
    throw new WalletNotFoundError();
  }

  const provider = getProvider();
  const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts[0]) throw new Error("Wallet returned no accounts.");
  return accounts[0].toLowerCase();
}

/** Get currently connected accounts without prompting */
export async function getAccounts(): Promise<string[]> {
  const provider = getProvider();
  if (!provider) return [];
  try {
    return await provider.request({ method: "eth_accounts" });
  } catch {
    return [];
  }
}

/** Sign a personal message (EIP-191) using the connected wallet */
export async function personalSign(message: string, address: string): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new WalletNotFoundError();

  // Sovegent Wallet extended signing — uses the SDK directly for richer proof output
  const win = window as any;
  if (win.sovegent?.sign) {
    return win.sovegent.sign({ message, address });
  }

  // Standard EIP-191 personal_sign
  return provider.request({
    method: "personal_sign",
    params: [message, address],
  });
}

/**
 * Subscribe to account changes.
 * Returns an unsubscribe function.
 */
export function onAccountsChanged(cb: (accounts: string[]) => void): () => void {
  const provider = getProvider();
  if (!provider) return () => {};
  provider.on("accountsChanged", cb);
  return () => provider.removeListener("accountsChanged", cb);
}

/**
 * Subscribe to chain changes.
 * Returns an unsubscribe function.
 */
export function onChainChanged(cb: (chainId: string) => void): () => void {
  const provider = getProvider();
  if (!provider) return () => {};
  provider.on("chainChanged", cb);
  return () => provider.removeListener("chainChanged", cb);
}

/** Custom error for missing wallet */
export class WalletNotFoundError extends Error {
  constructor() {
    super(
      "No wallet detected. Install Sovegent Wallet to get started: https://github.com/sovegent/sovegent-wallet"
    );
    this.name = "WalletNotFoundError";
  }
}
