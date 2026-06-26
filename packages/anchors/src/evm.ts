/**
 * EVM Anchor Adapter
 *
 * Embeds a LiberProof fingerprint in transaction calldata.
 * Format: `0x6c70663a` ("lpf:") + 32-byte proof hash
 * ~21,000 + ~4,000 gas per anchor (~$0.01-0.50 depending on chain/gas price)
 *
 * No smart contract required. Compatible with any EVM chain.
 * For queryable on-chain lookups, see ProofRegistry.sol (planned).
 *
 * Requires viem as a peer dependency: pnpm add viem
 */
import type { AnchorAdapter } from "./types.js";
import type { ChainAnchor } from "@liberproof/core";

// Lazy viem types — we import at runtime to keep viem as a peer dep
type PublicClient = {
  getTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{ blockNumber: bigint; status: string }>;
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{ blockNumber: bigint; status: string }>;
  getTransaction: (args: { hash: `0x${string}` }) => Promise<{ input: `0x${string}` }>;
  readContract: (args: unknown) => Promise<unknown>;
};

type WalletClient = {
  sendTransaction: (args: { to: `0x${string}`; data: `0x${string}`; value: bigint }) => Promise<`0x${string}`>;
  account: { address: `0x${string}` } | null;
};

export interface EvmAnchorConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  /** Human-readable chain name stored in the anchor record (e.g. "ethereum", "polygon") */
  chainName: string;
}

/** LP fingerprint prefix: ASCII "lpf:" = 0x6c706634 */
const LP_PREFIX = "6c70663a";

/** Build calldata: 0x + "lpf:" + 32-byte proof hash */
function buildCalldata(proofHash: string): `0x${string}` {
  const cleanHash = proofHash.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  return `0x${LP_PREFIX}${cleanHash}`;
}

export class EvmAnchorAdapter implements AnchorAdapter {
  readonly chain: string;

  constructor(private config: EvmAnchorConfig) {
    this.chain = config.chainName;
  }

  /**
   * Anchor a proof hash on-chain by embedding it in transaction calldata.
   * Sends to the zero address (0x000...000) — a well-known burn address.
   * This is the cheapest approach that leaves an immutable on-chain record.
   */
  async anchor(proofHash: string): Promise<ChainAnchor> {
    const calldata = buildCalldata(proofHash);

    // Send to the zero address — no ETH value transferred, just calldata
    const txHash = await this.config.walletClient.sendTransaction({
      to: "0x0000000000000000000000000000000000000000",
      data: calldata,
      value: 0n,
    });

    // Wait for confirmation
    const receipt = await this.config.publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      throw new Error(`Anchor transaction failed: ${txHash}`);
    }

    return {
      chain: this.chain,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      anchoredAt: new Date().toISOString(),
    };
  }

  /**
   * Verify a proof hash is anchored on-chain by fetching the tx and
   * comparing its calldata to the expected LiberProof fingerprint.
   */
  async verify(proofHash: string, anchor: ChainAnchor): Promise<boolean> {
    try {
      const tx = await this.config.publicClient.getTransaction({ hash: anchor.txHash as `0x${string}` });
      return (tx.input ?? "").toLowerCase() === buildCalldata(proofHash).toLowerCase();
    } catch {
      return false;
    }
  }
}

/**
 * Helper: Build a viem-compatible EVM anchor adapter from raw config.
 * 
 * Usage:
 *   import { createPublicClient, createWalletClient, http } from "viem";
 *   import { mainnet } from "viem/chains";
 *   import { privateKeyToAccount } from "viem/accounts";
 *
 *   const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");
 *   const adapter = new EvmAnchorAdapter({
 *     publicClient: createPublicClient({ chain: mainnet, transport: http(RPC_URL) }),
 *     walletClient: createWalletClient({ account, chain: mainnet, transport: http(RPC_URL) }),
 *     chainName: "ethereum",
 *   });
 */
