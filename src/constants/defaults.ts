import type { NetworkPresetConfig } from '@/simulation/types';

export const DEFAULT_NODE_COUNT = 6;
export const DEFAULT_PACKET_LOSS = 0;
export const DEFAULT_K = 4;
export const DEFAULT_REDUNDANCY_FACTOR = 1.33;
export const DEFAULT_GOSSIP_MESH_DEGREE = 6;
export const DEFAULT_SPEED = 1;

export const NETWORK_PRESETS: Record<string, NetworkPresetConfig> = {
  ethereum: {
    label: 'Ethereum',
    latencyMean: 30,
    latencyStdDev: 10,
    latencyMin: 5,
    latencyMax: 100,
    slotTimeMs: 12_000,
    processingDelayRLNC: 0.5,
    processingDelayGossip: 1,
    attestationDeadlineMs: 4_000,
    blockRewardLabel: '~0.05 ETH',
    blockRewardUsd: 150,
  },
  solana: {
    label: 'Solana',
    latencyMean: 15,
    latencyStdDev: 5,
    latencyMin: 3,
    latencyMax: 50,
    slotTimeMs: 400,
    processingDelayRLNC: 0.5,
    processingDelayGossip: 1,
    attestationDeadlineMs: 400,
    blockRewardLabel: '~0.01 SOL',
    blockRewardUsd: 2,
  },
  custom: {
    label: 'Custom',
    latencyMean: 25,
    latencyStdDev: 8,
    latencyMin: 3,
    latencyMax: 100,
    slotTimeMs: 1000,
    processingDelayRLNC: 0.5,
    processingDelayGossip: 1,
    attestationDeadlineMs: 500,
    blockRewardLabel: '',
    blockRewardUsd: 50,
  },
};
