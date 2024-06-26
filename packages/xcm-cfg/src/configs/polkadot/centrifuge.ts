import { AssetConfig, ChainConfig } from '@galacticcouncil/xcm-core';

import { cfg } from '../../assets';
import { centrifuge, hydraDX } from '../../chains';
import { BalanceBuilder, ExtrinsicBuilder } from '../../builders';

const toHydraDX: AssetConfig[] = [
  new AssetConfig({
    asset: cfg,
    balance: BalanceBuilder().substrate().system().account(),
    destination: hydraDX,
    destinationFee: {
      amount: 0.006373834498834048,
      asset: cfg,
      balance: BalanceBuilder().substrate().system().account(),
    },
    extrinsic: ExtrinsicBuilder().xTokens().transfer(),
  }),
];

export const centrifugeConfig = new ChainConfig({
  assets: [...toHydraDX],
  chain: centrifuge,
});
