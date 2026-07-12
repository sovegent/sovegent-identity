# @sovegent/anchors

Pluggable chain anchoring adapters for Sovegent Identity. Submit proof hashes on-chain for immutable timestamping.

## Adapters

| Adapter | Chain | Mechanism |
|---|---|---|
| `EvmAnchorAdapter` | Ethereum, Polygon, any EVM | Calldata embedding (`lpf:<hash>`) |
| `LiberlandAnchorAdapter` | Liberland Blockchain | `system.remark` (`LIBERPROOF:v1:<hash>`) |

## Install

```bash
# For EVM anchoring
pnpm add @sovegent/anchors viem

# For Liberland anchoring
pnpm add @sovegent/anchors @polkadot/api @polkadot/keyring
```

## Usage

```ts
import { EvmAnchorAdapter } from "@sovegent/anchors";
import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");
const adapter = new EvmAnchorAdapter({
  publicClient: createPublicClient({ chain: mainnet, transport: http() }),
  walletClient: createWalletClient({ account, chain: mainnet, transport: http() }),
  chainName: "ethereum",
});

const anchor = await adapter.anchor(proofHash);
// { chain: "ethereum", txHash: "0x...", blockNumber: 12345, anchoredAt: "..." }
```

See [docs/anchors/](../../docs/anchors/) for full setup guides.

## License

AGPL-3.0-or-later — see [LICENSE](../../LICENSE)
