import { Asset, AssetAmount } from '@galacticcouncil/xcm-core';

import { Observable } from 'rxjs';
import { XCall } from '../types';

export interface BalanceProvider<T> {
  read(asset: Asset, config: T): Promise<AssetAmount>;
  subscribe(asset: Asset, config: T): Promise<Observable<AssetAmount>>;
}

export interface TransferProvider<T> {
  estimateFee(
    account: string,
    amount: bigint,
    feeBalance: AssetAmount,
    config: T
  ): Promise<AssetAmount>;
  calldata(account: string, amount: bigint, config: T): Promise<XCall>;
}
