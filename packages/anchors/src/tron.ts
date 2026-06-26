/**
 * Tron Anchor Adapter — LiberProof
 * Anchors a proof hash in a Tron transaction's data/memo field:
 *   raw_data.data = utf8("LIBERPROOF:v1:<sha256hex>")   (same family format as Liberland remark)
 * Anchoring: a 1-sun transfer to the Tron zero address carrying the memo,
 *   built with tronweb's transactionBuilder.addUpdateData, signed, and broadcast.
 * Verification: keyless — reads raw_data.data back via trx.getTransaction and matches the memo.
 * Peer dep for anchor() + verify(): tronweb (v6).
 *
 * Networks: nile / shasta / mainnet (default fullHost per network).
 *
 * ✅ Verified on Tron Nile testnet (2026-06-26): anchored in tx
 *    774cc81a00c688420a0b169d86e9c04b57d6af42cfeadd6302c1d45941d269cf, verified back on-chain.
 */
import { Buffer } from "buffer";
import type { AnchorAdapter } from "./types.js";
import type { ChainAnchor } from "@liberproof/core";

const MEMO_PREFIX = "LIBERPROOF:v1:";

// Tron "zero" address (all-zero, base58check). Anchor target — parallels the EVM zero-address anchor.
const ZERO_ADDRESS = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

const FULL_HOSTS = {
  nile: "https://nile.trongrid.io",
  shasta: "https://api.shasta.trongrid.io",
  mainnet: "https://api.trongrid.io",
} as const;

export type TronNetwork = keyof typeof FULL_HOSTS;

export interface TronAnchorConfig {
  /** Sender private key (hex). Required for anchor(); not needed for verify(). */
  privateKey?: string;
  /** Full node host. Defaults to the host for the configured network. */
  fullHost?: string;
  /** Network preset selecting the default fullHost. Default: "nile". */
  network?: TronNetwork;
}

/** Build the on-chain memo string for a proof hash (normalized: strip 0x, lowercase). */
export function buildMemo(proofHash: string): string {
  return `${MEMO_PREFIX}${proofHash.replace(/^0x/, "").toLowerCase()}`;
}

export class TronAnchorAdapter implements AnchorAdapter {
  readonly chain = "tron";
  private fullHost: string;

  constructor(private config: TronAnchorConfig = {}) {
    this.fullHost = config.fullHost ?? FULL_HOSTS[config.network ?? "nile"];
  }

  /** Lazily load tronweb (large optional peer dep) and build a client. */
  private async client(privateKey?: string) {
    // @ts-ignore — optional peer dep
    const m = await import("tronweb").catch(() => {
      throw new Error("tronweb not installed. Run: pnpm add tronweb");
    });
    const TronWeb = (m as any).TronWeb || (m as any).default || m;
    return new TronWeb({ fullHost: this.fullHost, privateKey });
  }

  /**
   * Anchor a proof hash by sending 1 sun to the Tron zero address with the memo
   * "LIBERPROOF:v1:<hash>" attached to the transaction's data field.
   */
  async anchor(proofHash: string): Promise<ChainAnchor> {
    const { privateKey } = this.config;
    if (!privateKey) throw new Error("TronAnchorAdapter.anchor requires config.privateKey");
    const tronWeb = await this.client(privateKey);
    const own: string = tronWeb.address.fromPrivateKey(privateKey) || tronWeb.defaultAddress.base58;

    let tx = await tronWeb.transactionBuilder.sendTrx(ZERO_ADDRESS, 1, own);
    tx = await tronWeb.transactionBuilder.addUpdateData(tx, buildMemo(proofHash), "utf8");
    const signed = await tronWeb.trx.sign(tx);
    const res = await tronWeb.trx.sendRawTransaction(signed);
    if (!res || res.result !== true || !res.txid) {
      throw new Error(`Tron broadcast failed: ${JSON.stringify(res)}`);
    }
    return { chain: "tron", txHash: res.txid, anchoredAt: new Date().toISOString() };
  }

  /** Keyless verification — read raw_data.data back and compare to the expected memo. */
  async verify(proofHash: string, anchor: ChainAnchor): Promise<boolean> {
    const want = buildMemo(proofHash);
    const tronWeb = await this.client();
    const t = await tronWeb.trx.getTransaction(anchor.txHash);
    const dataHex: string | undefined = t?.raw_data?.data;
    const memo = dataHex ? Buffer.from(dataHex, "hex").toString("utf8") : "";
    return memo === want;
  }
}
