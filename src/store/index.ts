import { create } from 'zustand';
import type {
  FlexNode,
  Edge,
  NetworkTopology,
  ComparisonMode,
  NetworkPreset,
  TopologyType,
  AnimatedParticle,
  RLNCNodeState,
  GossipSubNodeState,
  ProtocolMetrics,
} from '@/simulation/types';
import { generateTopology } from '@/simulation/topology';
import { setSeed } from '@/lib/prng';
import {
  DEFAULT_NODE_COUNT,
  DEFAULT_PACKET_LOSS,
  DEFAULT_K,
  DEFAULT_REDUNDANCY_FACTOR,
  DEFAULT_GOSSIP_MESH_DEGREE,
  DEFAULT_SPEED,
} from '@/constants/defaults';

// ── State shape ──

export interface DashboardState {
  // Network
  nodes: FlexNode[];
  edges: Edge[];
  topology: TopologyType;

  // Controls
  nodeCount: number;
  packetLoss: number;
  networkPreset: NetworkPreset;
  comparisonMode: ComparisonMode;
  k: number;
  redundancyFactor: number;
  gossipMeshDegree: number;

  // Simulation
  running: boolean;
  speed: number;
  tick: number;
  publisherNodeId: string | null;
  subscriberNodeIds: string[];

  // Protocol state
  rlncStates: Map<string, RLNCNodeState>;
  gossipStates: Map<string, GossipSubNodeState>;

  // Animation
  particles: AnimatedParticle[];

  // Metrics
  rlncMetrics: ProtocolMetrics;
  gossipMetrics: ProtocolMetrics;

  // Timers (ms from propagation start)
  rlncDeliveryTime: number | null;
  gossipDeliveryTime: number | null;
  propagationStartTime: number | null;

  // Actions
  setNodeCount: (count: number) => void;
  setPacketLoss: (loss: number) => void;
  setNetworkPreset: (preset: NetworkPreset) => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  setTopology: (type: TopologyType) => void;
  setK: (k: number) => void;
  setSpeed: (speed: number) => void;
  regenerateTopology: () => void;
  startPropagation: (publisherId: string) => void;
  resetSimulation: () => void;
  setRunning: (running: boolean) => void;
  addParticle: (particle: AnimatedParticle) => void;
  removeParticle: (id: string) => void;
  updateParticles: (particles: AnimatedParticle[]) => void;
  setRLNCState: (nodeId: string, state: RLNCNodeState) => void;
  setGossipState: (nodeId: string, state: GossipSubNodeState) => void;
  setRLNCDeliveryTime: (time: number) => void;
  setGossipDeliveryTime: (time: number) => void;
  incrementRLNCTransmissions: (useful: boolean) => void;
  incrementGossipTransmissions: (useful: boolean) => void;
  setPropagationStartTime: (time: number) => void;
}

function emptyMetrics(): ProtocolMetrics {
  return {
    lastDeliveryMs: null,
    deliveryTimes: [],
    totalTransmissions: 0,
    usefulTransmissions: 0,
    successCount: 0,
    failCount: 0,
    partialCount: 0,
  };
}

function buildTopology(
  nodeCount: number,
  type: TopologyType,
  preset: string,
  packetLoss: number,
): NetworkTopology {
  setSeed(`mump2p-${nodeCount}-${type}-${Date.now()}`);
  return generateTopology(nodeCount, type, preset, packetLoss / 100);
}

export const useDashboardStore = create<DashboardState>((set, get) => {
  const initial = buildTopology(
    DEFAULT_NODE_COUNT,
    'mesh',
    'ethereum',
    DEFAULT_PACKET_LOSS,
  );

  return {
    // Network
    nodes: initial.nodes,
    edges: initial.edges,
    topology: 'mesh',

    // Controls
    nodeCount: DEFAULT_NODE_COUNT,
    packetLoss: DEFAULT_PACKET_LOSS,
    networkPreset: 'ethereum',
    comparisonMode: 'click',
    k: DEFAULT_K,
    redundancyFactor: DEFAULT_REDUNDANCY_FACTOR,
    gossipMeshDegree: DEFAULT_GOSSIP_MESH_DEGREE,

    // Simulation
    running: false,
    speed: DEFAULT_SPEED,
    tick: 0,
    publisherNodeId: null,
    subscriberNodeIds: [],

    // Protocol state
    rlncStates: new Map(),
    gossipStates: new Map(),

    // Animation
    particles: [],

    // Metrics
    rlncMetrics: emptyMetrics(),
    gossipMetrics: emptyMetrics(),

    // Timers
    rlncDeliveryTime: null,
    gossipDeliveryTime: null,
    propagationStartTime: null,

    // ── Actions ──

    setNodeCount: (count) => {
      const { topology, networkPreset, packetLoss } = get();
      const topo = buildTopology(count, topology, networkPreset, packetLoss);
      set({
        nodeCount: count,
        nodes: topo.nodes,
        edges: topo.edges,
        particles: [],
        running: false,
        tick: 0,
        publisherNodeId: null,
        rlncStates: new Map(),
        gossipStates: new Map(),
        rlncDeliveryTime: null,
        gossipDeliveryTime: null,
        rlncMetrics: emptyMetrics(),
        gossipMetrics: emptyMetrics(),
      });
    },

    setPacketLoss: (loss) => {
      set((state) => {
        const newEdges = state.edges.map((e) => ({
          ...e,
          packetLossRate: loss / 100,
        }));
        return { packetLoss: loss, edges: newEdges };
      });
    },

    setNetworkPreset: (preset) => {
      const { nodeCount, topology, packetLoss } = get();
      const topo = buildTopology(nodeCount, topology, preset, packetLoss);
      set({
        networkPreset: preset,
        nodes: topo.nodes,
        edges: topo.edges,
        particles: [],
        running: false,
        tick: 0,
        publisherNodeId: null,
        rlncStates: new Map(),
        gossipStates: new Map(),
        rlncDeliveryTime: null,
        gossipDeliveryTime: null,
      });
    },

    setComparisonMode: (mode) => set({ comparisonMode: mode }),
    setTopology: (type) => {
      const { nodeCount, networkPreset, packetLoss } = get();
      const topo = buildTopology(nodeCount, type, networkPreset, packetLoss);
      set({
        topology: type,
        nodes: topo.nodes,
        edges: topo.edges,
        particles: [],
        running: false,
        tick: 0,
        publisherNodeId: null,
        rlncStates: new Map(),
        gossipStates: new Map(),
      });
    },
    setK: (k) => set({ k }),
    setSpeed: (speed) => set({ speed }),

    regenerateTopology: () => {
      const { nodeCount, topology, networkPreset, packetLoss } = get();
      const topo = buildTopology(nodeCount, topology, networkPreset, packetLoss);
      set({
        nodes: topo.nodes,
        edges: topo.edges,
        particles: [],
        running: false,
        tick: 0,
        publisherNodeId: null,
        rlncStates: new Map(),
        gossipStates: new Map(),
        rlncDeliveryTime: null,
        gossipDeliveryTime: null,
      });
    },

    startPropagation: (publisherId) => {
      const { nodes, k } = get();
      // Initialize protocol states
      const rlncStates = new Map<string, RLNCNodeState>();
      const gossipStates = new Map<string, GossipSubNodeState>();
      const subscriberIds: string[] = [];

      for (const node of nodes) {
        const isPublisher = node.id === publisherId;
        rlncStates.set(node.id, {
          nodeId: node.id,
          coefficientMatrix: [],
          rank: isPublisher ? k : 0,
          k,
          reconstructed: isPublisher,
          shardsReceived: isPublisher ? k : 0,
          firstShardTick: isPublisher ? 0 : null,
          reconstructionTick: isPublisher ? 0 : null,
        });
        gossipStates.set(node.id, {
          nodeId: node.id,
          hasMessage: isPublisher,
          receivedAtTick: isPublisher ? 0 : null,
          forwardedTo: [],
          duplicatesReceived: 0,
        });
        if (!isPublisher) subscriberIds.push(node.id);
        // Update role
        node.role = isPublisher ? 'publisher' : 'relay';
      }

      set({
        publisherNodeId: publisherId,
        subscriberNodeIds: subscriberIds,
        rlncStates,
        gossipStates,
        running: true,
        tick: 0,
        particles: [],
        rlncDeliveryTime: null,
        gossipDeliveryTime: null,
        rlncMetrics: emptyMetrics(),
        gossipMetrics: emptyMetrics(),
        propagationStartTime: performance.now(),
      });
    },

    resetSimulation: () => {
      set({
        running: false,
        tick: 0,
        particles: [],
        publisherNodeId: null,
        subscriberNodeIds: [],
        rlncStates: new Map(),
        gossipStates: new Map(),
        rlncDeliveryTime: null,
        gossipDeliveryTime: null,
        rlncMetrics: emptyMetrics(),
        gossipMetrics: emptyMetrics(),
        propagationStartTime: null,
      });
    },

    setRunning: (running) => set({ running }),
    addParticle: (particle) =>
      set((state) => ({ particles: [...state.particles, particle] })),
    removeParticle: (id) =>
      set((state) => ({
        particles: state.particles.filter((p) => p.id !== id),
      })),
    updateParticles: (particles) => set({ particles }),
    setRLNCState: (nodeId, state) =>
      set((s) => {
        const newMap = new Map(s.rlncStates);
        newMap.set(nodeId, state);
        return { rlncStates: newMap };
      }),
    setGossipState: (nodeId, state) =>
      set((s) => {
        const newMap = new Map(s.gossipStates);
        newMap.set(nodeId, state);
        return { gossipStates: newMap };
      }),
    setRLNCDeliveryTime: (time) =>
      set((s) => ({
        rlncDeliveryTime: time,
        rlncMetrics: {
          ...s.rlncMetrics,
          lastDeliveryMs: time,
          deliveryTimes: [...s.rlncMetrics.deliveryTimes, time],
          successCount: s.rlncMetrics.successCount + 1,
        },
      })),
    setGossipDeliveryTime: (time) =>
      set((s) => ({
        gossipDeliveryTime: time,
        gossipMetrics: {
          ...s.gossipMetrics,
          lastDeliveryMs: time,
          deliveryTimes: [...s.gossipMetrics.deliveryTimes, time],
          successCount: s.gossipMetrics.successCount + 1,
        },
      })),
    incrementRLNCTransmissions: (useful) =>
      set((s) => ({
        rlncMetrics: {
          ...s.rlncMetrics,
          totalTransmissions: s.rlncMetrics.totalTransmissions + 1,
          usefulTransmissions:
            s.rlncMetrics.usefulTransmissions + (useful ? 1 : 0),
        },
      })),
    incrementGossipTransmissions: (useful) =>
      set((s) => ({
        gossipMetrics: {
          ...s.gossipMetrics,
          totalTransmissions: s.gossipMetrics.totalTransmissions + 1,
          usefulTransmissions:
            s.gossipMetrics.usefulTransmissions + (useful ? 1 : 0),
        },
      })),
    setPropagationStartTime: (time) => set({ propagationStartTime: time }),
  };
});
