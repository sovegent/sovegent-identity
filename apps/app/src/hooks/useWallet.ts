/**
 * useWallet — React hook for wallet state and auth
 */
import { useState, useEffect, useCallback } from "react";
import {
  detectWallet,
  connectWallet,
  getAccounts,
  onAccountsChanged,
  type WalletType,
  WalletNotFoundError,
} from "../lib/wallet.js";
import { signInWithWallet, getStoredAddress, signOut } from "../lib/siwe.js";

export interface WalletState {
  walletType: WalletType;
  address: string | null;
  isConnected: boolean;
  isAuthenticating: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

export function useWallet(): WalletState {
  const [walletType, setWalletType] = useState<WalletType>("none");
  const [address, setAddress] = useState<string | null>(getStoredAddress());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect wallet on mount
  useEffect(() => {
    setWalletType(detectWallet());
  }, []);

  // Watch for account changes from wallet extension
  useEffect(() => {
    const unsub = onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        signOut();
        setAddress(null);
      } else if (accounts[0] && accounts[0].toLowerCase() !== address) {
        // Account switched — require re-auth
        signOut();
        setAddress(null);
        setError("Wallet account changed. Please sign in again.");
      }
    });
    return unsub;
  }, [address]);

  const connect = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const addr = await connectWallet();
      await signInWithWallet(addr);
      setAddress(addr.toLowerCase());
    } catch (e: unknown) {
      if (e instanceof WalletNotFoundError) {
        setError(e.message);
      } else if (e instanceof Error) {
        // User rejected signature
        if (e.message.includes("rejected") || e.message.includes("denied")) {
          setError("Signature rejected. Sign the message to continue.");
        } else {
          setError(e.message);
        }
      } else {
        setError("Connection failed. Please try again.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    signOut();
    setAddress(null);
    setError(null);
  }, []);

  return {
    walletType,
    address,
    isConnected: !!address,
    isAuthenticating,
    error,
    connect,
    disconnect,
    clearError: () => setError(null),
  };
}
