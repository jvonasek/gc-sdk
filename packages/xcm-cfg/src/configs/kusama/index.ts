import { ChainConfig } from '@moonbeam-network/xcm-config';

import { assetHubConfig } from './assethub';
import { basiliskConfig } from './basilisk';
import { karuraConfig } from './karura';
import { kusamaConfig } from './kusama';
import { tinkernetConfig } from './tinkernet';
import { robonomicsConfig } from './robonomics';

export const kusamaChainsConfig: ChainConfig[] = [
  assetHubConfig,
  basiliskConfig,
  karuraConfig,
  kusamaConfig,
  tinkernetConfig,
  robonomicsConfig,
];
