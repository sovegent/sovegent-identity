/**
 * Cardano Anchor Adapter — LiberProof
 * Anchors a proof hash in Cardano tx metadata (label 1644):
 *   { "1644": { "liberproof": { "v": 1, "proof_hash": "<sha256hex>" } } }
 * Anchoring: pure-TS tx build (@stricahq/typhonjs) + Koios /address_utxos + /submittx
 *   (the stack proven in LiberVault). networkId 0 = preprod, 1 = mainnet.
 * Verification: keyless — reads metadata back from Koios /tx_metadata and matches.
 * Peer deps for anchor(): @stricahq/typhonjs, @stricahq/bip32ed25519, bignumber.js.
 */
import { Buffer } from "buffer";
import type { AnchorAdapter } from "./types.js";
import type { ChainAnchor } from "@liberproof/core";

export const METADATA_LABEL = 1644;
const KOIOS_MAINNET = "https://api.koios.rest/api/v1";
const KOIOS_PREPROD = "https://preprod.koios.rest/api/v1";

export interface CardanoAnchorConfig {
  networkId?: 0 | 1;        // 1 = mainnet (default), 0 = preprod
  koiosUrl?: string;
  address?: string;         // funded sender addr (required for anchor())
  paymentXprvHex?: string;  // Ed25519-BIP32 xprv hex (required for anchor())
}

export function buildMetadatum(proofHash: string) {
  return { liberproof: { v: 1, proof_hash: proofHash.replace(/^0x/, "").toLowerCase() } };
}

export class CardanoAnchorAdapter implements AnchorAdapter {
  readonly chain = "cardano";
  private koios: string;
  constructor(private config: CardanoAnchorConfig = {}) {
    this.koios = config.koiosUrl ?? ((config.networkId ?? 1) === 1 ? KOIOS_MAINNET : KOIOS_PREPROD);
  }

  async anchor(proofHash: string): Promise<ChainAnchor> {
    const { address, paymentXprvHex } = this.config;
    if (!address || !paymentXprvHex) throw new Error("CardanoAnchorAdapter.anchor requires config.address + config.paymentXprvHex");
    // @ts-ignore — optional peer dep
    const { Bip32PrivateKey } = await import("@stricahq/bip32ed25519");
    // @ts-ignore — optional peer dep
    const typhon = await import("@stricahq/typhonjs");
    // @ts-ignore — optional peer dep
    const BigNumber = (await import("bignumber.js")).default;

    const ep = (await (await fetch(`${this.koios}/epoch_params`)).json())[0];
    const protocolParams = {
      minFeeA: new BigNumber(ep.min_fee_a), minFeeB: new BigNumber(ep.min_fee_b),
      stakeKeyDeposit: new BigNumber(ep.key_deposit), lovelacePerUtxoWord: new BigNumber(34482),
      utxoCostPerByte: new BigNumber(ep.coins_per_utxo_size ?? 4310),
      collateralPercent: new BigNumber(ep.collateral_percent ?? 150),
      priceSteps: new BigNumber(ep.price_step ?? 0.0000721), priceMem: new BigNumber(ep.price_mem ?? 0.0577),
      languageView: {}, maxTxSize: Number(ep.max_tx_size ?? 16384), maxValueSize: Number(ep.max_val_size ?? 5000),
    };
    const utxosRaw = await (await fetch(`${this.koios}/address_utxos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _addresses: [address], _extended: false }),
    })).json();
    if (!Array.isArray(utxosRaw) || !utxosRaw.length) throw new Error("No UTXOs at address");
    const tip = (await (await fetch(`${this.koios}/tip`)).json())[0];
    const ttl = Number(tip.abs_slot) + 7200;
    const fromAddr = typhon.utils.getAddressFromString(address);
    const inputs = utxosRaw.map((u: any) => ({ txId: u.tx_hash, index: u.tx_index, amount: new BigNumber(u.value), tokens: [], address: fromAddr }));
    const output = { address: fromAddr, amount: new BigNumber(1_000_000), tokens: [] }; // 1 ADA back to self
    const auxiliaryData = { metadata: [{ label: METADATA_LABEL, data: buildMetadatum(proofHash) }] };
    const txBuilder = new typhon.Transaction({ protocolParams: protocolParams as any });
    const tx = txBuilder.paymentTransaction({ inputs: inputs as any, outputs: [output] as any, changeAddress: fromAddr, auxiliaryData: auxiliaryData as any, ttl });
    const payKey = new Bip32PrivateKey(Buffer.from(paymentXprvHex, "hex")).toPrivateKey();
    const txHash = tx.getTransactionHash();
    tx.addWitness({ publicKey: payKey.toPublicKey().toBytes(), signature: payKey.sign(txHash) });
    const { payload } = tx.buildTransaction();
    const sub = await fetch(`${this.koios}/submittx`, { method: "POST", headers: { "Content-Type": "application/cbor" }, body: Buffer.from(payload, "hex") });
    if (!sub.ok) throw new Error(`submittx ${sub.status}: ${await sub.text()}`);
    const txHashHex = (await sub.text()).replace(/"/g, "");
    return { chain: "cardano", txHash: txHashHex, anchoredAt: new Date().toISOString() };
  }

  async verify(proofHash: string, anchor: ChainAnchor): Promise<boolean> {
    const want = proofHash.replace(/^0x/, "").toLowerCase();
    const res = await fetch(`${this.koios}/tx_metadata`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _tx_hashes: [anchor.txHash] }),
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ metadata?: Record<string, any> }>;
    for (const row of rows) {
      const got = row.metadata?.[String(METADATA_LABEL)]?.liberproof?.proof_hash;
      if (typeof got === "string" && got.toLowerCase() === want) return true;
    }
    return false;
  }
}
