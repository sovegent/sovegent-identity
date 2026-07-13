# EVM Anchor Adapter

The EVM adapter anchors proof hashes on any EVM-compatible chain by embedding
the hash in transaction calldata. No smart contract is required for basic use,
though a `ProofRegistry.sol` contract is planned for queryable on-chain lookups.

## Setup

```bash
pnpm add viem @sovegent/anchors
```

## Usage

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";
import { EvmAnchorAdapter } from "@sovegent/anchors";

const adapter = new EvmAnchorAdapter({
  publicClient: createPublicClient({ chain: mainnet, transport: http() }),
  walletClient: createWalletClient({ chain: mainnet, transport: http() }),
  chainName: "ethereum",
});

const anchor = await adapter.anchor(record.proof.payloadHash);
```

## How it works

The proof hash (32 bytes / 64 hex chars) is prefixed with `0x6c7066:` (UTF-8
for `lpf:` — Sovegent Identity fingerprint) and written as transaction `data`.
This costs ~4 gas per zero byte, ~16 gas per non-zero byte — typically
under 10,000 gas total for a 32-byte hash.
