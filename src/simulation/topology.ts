import type { FlexNode, Edge, NetworkTopology, TopologyType } from './types';
import { random, randomNormal, shuffle } from '@/lib/prng';
import { NETWORK_PRESETS } from '@/constants/defaults';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const NODE_PADDING = 80;

function nodeId(i: number): string {
  return `node-${i}`;
}

function nodeLabel(i: number): string {
  return String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '');
}

/** Generate random positions spread across the canvas */
function randomPositions(count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute in a roughly circular layout with jitter
    const angle = (2 * Math.PI * i) / count + (random() - 0.5) * 0.5;
    const radius = 200 + random() * 80;
    positions.push({
      x: CANVAS_WIDTH / 2 + Math.cos(angle) * radius,
      y: CANVAS_HEIGHT / 2 + Math.sin(angle) * radius,
    });
  }
  return positions;
}

function createNodes(count: number): FlexNode[] {
  const positions = randomPositions(count);
  return positions.map((pos, i) => ({
    id: nodeId(i),
    label: nodeLabel(i),
    position: pos,
    role: 'relay' as const,
    neighbors: [],
  }));
}

function makeEdge(
  source: string,
  target: string,
  preset: string,
  globalLoss: number,
): Edge {
  const config = NETWORK_PRESETS[preset] ?? NETWORK_PRESETS.ethereum;
  const latency = randomNormal(
    config.latencyMean,
    config.latencyStdDev,
    config.latencyMin,
    config.latencyMax,
  );
  return {
    id: `${source}->${target}`,
    source,
    target,
    latencyMs: Math.round(latency * 10) / 10,
    packetLossRate: globalLoss,
  };
}

/** Ensure the graph is connected via a spanning path, then add random edges */
function generateMesh(
  nodes: FlexNode[],
  preset: string,
  globalLoss: number,
): Edge[] {
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  const addEdge = (a: string, b: string) => {
    const key = [a, b].sort().join('--');
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push(makeEdge(a, b, preset, globalLoss));
    edges.push(makeEdge(b, a, preset, globalLoss));
    const nodeA = nodes.find((n) => n.id === a)!;
    const nodeB = nodes.find((n) => n.id === b)!;
    if (!nodeA.neighbors.includes(b)) nodeA.neighbors.push(b);
    if (!nodeB.neighbors.includes(a)) nodeB.neighbors.push(a);
  };

  // Spanning path for connectivity
  const shuffled = shuffle([...nodes.map((n) => n.id)]);
  for (let i = 0; i < shuffled.length - 1; i++) {
    addEdge(shuffled[i], shuffled[i + 1]);
  }

  // Add random extra edges for mesh density (target avg degree ~3)
  const targetExtraEdges = Math.max(0, Math.floor(nodes.length * 1.5) - (nodes.length - 1));
  for (let attempt = 0; attempt < targetExtraEdges * 3 && edges.length / 2 < nodes.length * 1.5; attempt++) {
    const a = nodes[Math.floor(random() * nodes.length)].id;
    const b = nodes[Math.floor(random() * nodes.length)].id;
    if (a !== b) addEdge(a, b);
  }

  return edges;
}

function generateRing(
  nodes: FlexNode[],
  preset: string,
  globalLoss: number,
): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const b = nodes[(i + 1) % nodes.length];
    const fwd = makeEdge(a.id, b.id, preset, globalLoss);
    const bwd = makeEdge(b.id, a.id, preset, globalLoss);
    edges.push(fwd, bwd);
    a.neighbors.push(b.id);
    b.neighbors.push(a.id);
  }
  return edges;
}

function generateStar(
  nodes: FlexNode[],
  preset: string,
  globalLoss: number,
): Edge[] {
  const edges: Edge[] = [];
  const hub = nodes[0];
  for (let i = 1; i < nodes.length; i++) {
    const spoke = nodes[i];
    edges.push(makeEdge(hub.id, spoke.id, preset, globalLoss));
    edges.push(makeEdge(spoke.id, hub.id, preset, globalLoss));
    hub.neighbors.push(spoke.id);
    spoke.neighbors.push(hub.id);
  }
  return edges;
}

export function generateTopology(
  nodeCount: number,
  type: TopologyType,
  preset: string,
  globalLoss: number,
): NetworkTopology {
  const nodes = createNodes(nodeCount);

  let edges: Edge[];
  switch (type) {
    case 'ring':
      edges = generateRing(nodes, preset, globalLoss);
      break;
    case 'star':
      edges = generateStar(nodes, preset, globalLoss);
      break;
    case 'mesh':
    case 'random':
    default:
      edges = generateMesh(nodes, preset, globalLoss);
      break;
  }

  return { nodes, edges };
}
