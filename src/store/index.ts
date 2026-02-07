import { create } from 'zustand';
import type {
  FlexNode,
  Edge,
  NetworkTopology,
  ComparisonMode,
  NetworkPreset,
  TopologyType,
  AnimatedParticle,
  SlotResult,
} from '@/simulation/types';
import type { EngineMetrics } from '@/simulation/engine';
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
  simTime: number;          // Current simulated time in ms (starts at 0)
  publisherNodeId: string | null;
  subscriberNodeIds: string[];
  simulationDone: boolean;

  // Animation
  particles: AnimatedParticle[];

  // Metrics (pushed from engine)
  engineMetrics: EngineMetrics | null;

  // Continuous mode slot tracking
  slotResults: SlotResult[];

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
  setSimTime: (t: number) => void;
  updateParticles: (particles: AnimatedParticle[]) => void;
  pushEngineMetrics: (m: EngineMetrics) => void;
  setSimulationDone: (done: boolean) => void;
  recordSlotResult: (result: SlotResult) => void;
  clearSlotResults: () => void;
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
    simTime: 0,
    publisherNodeId: null,
    subscriberNodeIds: [],
    simulationDone: false,

    // Animation
    particles: [],

    // Metrics
    engineMetrics: null,

    // Continuous mode
    slotResults: [],

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
        simTime: 0,
        publisherNodeId: null,
        subscriberNodeIds: [],
        engineMetrics: null,
        simulationDone: false,
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
        simTime: 0,
        publisherNodeId: null,
        subscriberNodeIds: [],
        engineMetrics: null,
        simulationDone: false,
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
        simTime: 0,
        publisherNodeId: null,
        subscriberNodeIds: [],
        engineMetrics: null,
        simulationDone: false,
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
        simTime: 0,
        publisherNodeId: null,
        subscriberNodeIds: [],
        engineMetrics: null,
        simulationDone: false,
      });
    },

    startPropagation: (publisherId) => {
      const { nodes } = get();
      const subscriberIds: string[] = [];
      for (const node of nodes) {
        if (node.id !== publisherId) {
          subscriberIds.push(node.id);
          node.role = 'relay';
        } else {
          node.role = 'publisher';
        }
      }

      set({
        publisherNodeId: publisherId,
        subscriberNodeIds: subscriberIds,
        running: true,
        simTime: 0,
        particles: [],
        engineMetrics: null,
        simulationDone: false,
      });
    },

    resetSimulation: () => {
      set({
        running: false,
        simTime: 0,
        particles: [],
        publisherNodeId: null,
        subscriberNodeIds: [],
        engineMetrics: null,
        simulationDone: false,
        slotResults: [],
      });
    },

    setRunning: (running) => set({ running }),
    setSimTime: (t) => set({ simTime: t }),
    updateParticles: (particles) => set({ particles }),
    pushEngineMetrics: (m) => set({ engineMetrics: m }),
    setSimulationDone: (done) => set({ simulationDone: done, running: !done }),

    recordSlotResult: (result) =>
      set((state) => ({ slotResults: [...state.slotResults, result] })),

    clearSlotResults: () => set({ slotResults: [] }),
  };
});
