import type {
  HydradxRuntimeXcmAssetLocation,
  PalletAssetRegistryAssetDetails,
  PalletAssetRegistryAssetMetadata,
  PalletStableswapPoolInfo,
} from '@polkadot/types/lookup';
import { ITuple } from '@polkadot/types-codec/types';
import { u32, u64 } from '@polkadot/types-codec';
import { ApiPromise } from '@polkadot/api';
import { SYSTEM_ASSET_ID } from '../consts';
import { Asset, AssetMetadata, AssetBase } from '../types';
import { findNestedKey } from '../utils/json';

import { PolkadotApiClient } from './PolkadotApi';

export class AssetClient extends PolkadotApiClient {
  private SUPPORTED_TYPES = ['StableSwap', 'Bond', 'Token'];

  constructor(api: ApiPromise) {
    super(api);
  }

  async safeSharesQuery(): Promise<Map<string, PalletStableswapPoolInfo>> {
    try {
      const entries = await this.api.query.stableswap.pools.entries();
      return new Map(
        entries.map(
          ([
            {
              args: [id],
            },
            value,
          ]) => [id.toString(), value.unwrap()]
        )
      );
    } catch (error) {
      return new Map([]);
    }
  }

  async safeBondsQuery(): Promise<Map<string, ITuple<[u32, u64]>>> {
    try {
      const entries = await this.api.query.bonds.bonds.entries();
      return new Map(
        entries.map(
          ([
            {
              args: [id],
            },
            value,
          ]) => {
            return [id.toString(), value.unwrap()];
          }
        )
      );
    } catch (error) {
      return new Map([]);
    }
  }

  async metadataQuery(): Promise<Map<string, AssetMetadata>> {
    try {
      const entries =
        await this.api.query.assetRegistry.assetMetadataMap.entries();
      return new Map(
        entries.map(
          ([
            {
              args: [id],
            },
            value,
          ]) => {
            //@ts-ignore
            const { decimals, symbol } = value.unwrap();
            return [
              id.toString(),
              {
                decimals: decimals.toNumber(),
                symbol: symbol.toHuman() as string,
              },
            ];
          }
        )
      );
    } catch (error) {
      return new Map([]);
    }
  }

  async locationsQuery(): Promise<Map<string, HydradxRuntimeXcmAssetLocation>> {
    try {
      const entries =
        await this.api.query.assetRegistry.assetLocations.entries();
      return new Map(
        entries.map(
          ([
            {
              args: [id],
            },
            value,
          ]) => {
            return [id.toString(), value.unwrap()];
          }
        )
      );
    } catch (error) {
      return new Map([]);
    }
  }

  private getTokens(
    tokenKey: string,
    details: PalletAssetRegistryAssetDetails,
    metadata: Map<string, AssetMetadata>,
    locations?: Map<string, HydradxRuntimeXcmAssetLocation>
  ): Asset {
    if (tokenKey == SYSTEM_ASSET_ID) {
      const defaultAssetEd = this.api.consts.balances.existentialDeposit;
      return {
        id: SYSTEM_ASSET_ID,
        name: this.chainToken,
        symbol: this.chainToken,
        decimals: this.chainDecimals,
        icon: this.chainToken,
        type: 'Token',
        existentialDeposit: defaultAssetEd.toString(),
      } as Asset;
    }

    const { name, assetType, existentialDeposit } = details;
    const { symbol, decimals } = metadata.get(tokenKey) ?? {};
    const location = locations ? locations.get(tokenKey) : undefined;

    return {
      id: tokenKey,
      name: name.toHuman(),
      symbol: symbol,
      decimals: decimals,
      icon: symbol,
      type: assetType.toHuman(),
      origin: location && this.parseLocation(location),
      existentialDeposit: existentialDeposit.toString(),
    } as Asset;
  }

  private getBonds(
    tokenKey: string,
    details: PalletAssetRegistryAssetDetails,
    metadata: Map<string, AssetMetadata>,
    bond: ITuple<[u32, u64]>
  ): Asset {
    const [underlyingAsset, maturity] = bond;
    const { assetType, existentialDeposit } = details;
    const { symbol, decimals } = this.getTokens(
      underlyingAsset.toString(),
      details,
      metadata
    );
    const bondMaturity = maturity.toNumber();
    const bondFormatter = new Intl.DateTimeFormat('en-GB');
    const bondName = [symbol, 'Bond', bondFormatter.format(bondMaturity)].join(
      ' '
    );
    return {
      id: tokenKey,
      name: bondName,
      symbol: symbol + 'b',
      decimals: decimals,
      icon: symbol,
      type: assetType.toString(),
      existentialDeposit: existentialDeposit.toString(),
    } as Asset;
  }

  private getShares(
    tokenKey: string,
    details: PalletAssetRegistryAssetDetails,
    metadata: Map<string, AssetMetadata>,
    share: PalletStableswapPoolInfo
  ): Asset {
    const { assets } = share;
    const { name, symbol, assetType, existentialDeposit } = details;
    const poolTokens = assets.map((asset) => asset.toString());
    const poolEntries = poolTokens.map((token: string) => {
      const { symbol } = this.getTokens(token, details, metadata);
      return [token, symbol];
    });
    const meta = Object.fromEntries(poolEntries);
    const symbols = Object.values(meta);
    return {
      id: tokenKey,
      name: symbols.join(', '),
      symbol: symbol?.isSome ? symbol.toHuman() : name.toHuman(),
      decimals: 18,
      icon: symbols.join('/'),
      type: assetType.toString(),
      existentialDeposit: existentialDeposit.toString(),
      meta: meta,
    } as Asset;
  }

  async getOnChainAssets(external?: AssetBase[]): Promise<Asset[]> {
    const [asset, assetLocations, shares, bonds, assetMetadata] =
      await Promise.all([
        this.api.query.assetRegistry.assets.entries(),
        this.locationsQuery(),
        this.safeSharesQuery(),
        this.safeBondsQuery(),
        this.metadataQuery(),
      ]);

    const filteredAssets = asset.filter(
      ([
        {
          args: [id],
        },
        state,
      ]) => {
        if (state.isNone) {
          return false;
        }
        const details = state.unwrap();
        const ext = external?.find((a) => a.id === id.toString());
        return this.isSupportedAsset(details, ext);
      }
    );

    const assetsMeta: Map<string, AssetMetadata> = assetMetadata.size
      ? assetMetadata
      : new Map(
          filteredAssets.map(
            ([
              {
                args: [id],
              },
              value,
            ]) => {
              const { decimals, symbol } = value.unwrap();
              return [
                id.toString(),
                {
                  decimals: Number(decimals.toString()),
                  symbol: symbol.toHuman() as string,
                },
              ];
            }
          )
        );

    return filteredAssets.map(
      ([
        {
          args: [id],
        },
        value,
      ]) => {
        const details: PalletAssetRegistryAssetDetails = value.unwrap();
        const { assetType } = details;
        switch (assetType.toString()) {
          case 'Bond':
            const bond = bonds.get(id.toString());
            return this.getBonds(id.toString(), details, assetsMeta, bond!);
          case 'StableSwap':
            const share = shares.get(id.toString());
            return this.getShares(id.toString(), details, assetsMeta, share!);
          case 'External':
            const base = external?.find((a) => a.id === id.toString());
            const token = this.getTokens(
              id.toString(),
              details,
              new Map(),
              assetLocations
            );
            return { ...token, ...base };
          default:
            return this.getTokens(
              id.toString(),
              details,
              assetsMeta,
              assetLocations
            );
        }
      }
    );
  }

  private isSupportedAsset(
    details: PalletAssetRegistryAssetDetails,
    external?: AssetBase
  ): boolean {
    const type = details.assetType.toString();
    const isSupported = this.SUPPORTED_TYPES.includes(type);
    const isExternal = !!external && type === 'External';
    return isSupported || isExternal;
  }

  private parseLocation(
    location: HydradxRuntimeXcmAssetLocation
  ): number | undefined {
    if (location) {
      const entry = findNestedKey(location.toJSON(), 'parachain');
      return entry && entry.parachain;
    } else {
      return undefined;
    }
  }
}
