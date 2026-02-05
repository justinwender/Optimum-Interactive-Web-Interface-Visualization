// ── Core simulation types ──

export interface FlexNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  role: 'publisher' | 'relay' | 'subscriber';
  neighbors: string[];
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  latencyMs: number;
  packetLossRate: number;
}

export interface NetworkTopology {
  nodes: FlexNode[];
  edges: Edge[];
}

// ── Protocol-specific state ──

export interface RLNCNodeState {
  nodeId: string;
  /** Rows = received coding vectors (each row is length k) */
  coefficientMatrix: number[][];
  rank: number;
  k: number;
  reconstructed: boolean;
  shardsReceived: number;
  firstShardTick: number | null;
  reconstructionTick: number | null;
}

export interface GossipSubNodeState {
  nodeId: string;
  hasMessage: boolean;
  receivedAtTick: number | null;
  forwardedTo: string[];
  duplicatesReceived: number;
}

// ── Events ──

export type SimEventType =
  | 'shard_arrive'
  | 'message_arrive'
  | 'recode_forward'
  | 'gossip_forward'
  | 'reconstruct';

export interface SimEvent {
  tick: number;
  type: SimEventType;
  protocol: 'rlnc' | 'gossipsub';
  payload: {
    fromNode: string;
    toNode: string;
    shardIndex?: number;
    codingVector?: number[];
    shardData?: number[];
    messageId?: string;
  };
}

// ── Animation ──

export interface AnimatedParticle {
  id: string;
  protocol: 'rlnc' | 'gossipsub';
  fromNode: string;
  toNode: string;
  /** 0 → 1, progress along the edge */
  progress: number;
  /** ms total travel time */
  duration: number;
  /** Timestamp when this particle started */
  startTime: number;
  /** Shard index for RLNC color mapping; undefined for gossipsub */
  shardIndex?: number;
  /** Whether this particle was dropped (packet loss) */
  dropped: boolean;
}

export type ComparisonMode = 'click' | 'continuous';
export type NetworkPreset = 'ethereum' | 'solana' | 'custom';
export type TopologyType = 'mesh' | 'ring' | 'star' | 'random';

export interface NetworkPresetConfig {
  label: string;
  latencyMean: number;
  latencyStdDev: number;
  latencyMin: number;
  latencyMax: number;
  slotTimeMs: number;
  processingDelayRLNC: number;
  processingDelayGossip: number;
}

export interface SimulationMetrics {
  rlnc: ProtocolMetrics;
  gossipsub: ProtocolMetrics;
}

export interface ProtocolMetrics {
  lastDeliveryMs: number | null;
  deliveryTimes: number[];
  totalTransmissions: number;
  usefulTransmissions: number;
  successCount: number;
  failCount: number;
  partialCount: number;
}
