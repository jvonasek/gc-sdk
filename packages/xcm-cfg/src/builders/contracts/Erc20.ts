import {
  ContractConfig,
  ContractConfigBuilder,
  WormholeChain,
} from '@galacticcouncil/xcm-core';

import { parseAssetId } from '../utils';

export function Erc20() {
  return {
    approve: (): ContractConfigBuilder => ({
      build: (params) => {
        const { amount, asset, destination, source, via } = params;
        const ctx = via || source;
        const ctxWh = ctx as WormholeChain;
        const rcvWh = destination as WormholeChain;
        const assetId = ctx.getAssetId(asset);

        const spender = rcvWh.getTokenRelayer()
          ? ctxWh.getTokenRelayer()
          : ctxWh.getTokenBridge();
        return new ContractConfig({
          address: parseAssetId(assetId).toString(),
          args: [spender, amount],
          func: 'approve',
          module: 'Erc20',
        });
      },
    }),
  };
}
