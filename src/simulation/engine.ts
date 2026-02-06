/**
 * Discrete-event simulation engine.
 *
 * All times are in **simulated milliseconds** (starting from 0).
 * The animation loop advances simTime and calls `advanceTo(simTime)`
 * to process events that have fired.
 *
 * Both protocols share the same timeline for fair comparison.
 */

import type { AnimatedParticle, Edge } from './types';
import { MinHeap } from './eventQueue';
import { gfRandom } from '@/lib/galoisField';
import { IncrementalRankTracker } from '@/lib/gaussianElimination';
import { random } from '@/lib/prng';

// ── Event types ──

interface SimEvent {
  fireAt: number;
  seq: number;
  protocol: 'rlnc' | 'gossipsub';
  type: 'shard_arrive' | 'message_arrive';
  fromNode: string;
  toNode: string;
  shardIndex?: number;
  codingVector?: number[];
  dropped: boolean;
}

// ── Engine state (module-level singleton) ──

const eventQueue = new MinHeap<SimEvent>();
const rlncTrackers = new Map<string, IncrementalRankTracker>();

// Track what gossip nodes have received (set of nodeIds that have the message)
const gossipReceived = new Set<string>();
// Track which gossip nodes have already forwarded (to prevent infinite loops)
const gossipForwarded = new Set<string>();

// Edges lookup for fast access
let edgeLookup = new Map<string, Edge>();

// Per-node last RLNC reconstruction time (simulated ms)
const rlncNodeDeliveryTime = new Map<string, number>();
// Per-node last GossipSub delivery time (simulated ms)
const gossipNodeDeliveryTime = new Map<string, number>();

// Accumulated metrics (kept here for atomic updates, pushed to store periodically)
export interface EngineMetrics {
  rlnc: {
    totalTransmissions: number;
    usefulTransmissions: number;
    deliveredNodes: string[];
    lastDeliverySimMs: number | null;
    allDone: boolean;
  };
  gossipsub: {
    totalTransmissions: number;
    usefulTransmissions: number;
    duplicates: number;
    deliveredNodes: string[];
    lastDeliverySimMs: number | null;
    allDone: boolean;
  };
}

let metrics: EngineMetrics = emptyEngineMetrics();
let subscriberIds: string[] = [];
let publisherId: string | null = null;
let simK = 4;

function emptyEngineMetrics(): EngineMetrics {
  return {
    rlnc: {
      totalTransmissions: 0,
      usefulTransmissions: 0,
      deliveredNodes: [],
      lastDeliverySimMs: null,
      allDone: false,
    },
    gossipsub: {
      totalTransmissions: 0,
      usefulTransmissions: 0,
      duplicates: 0,
      deliveredNodes: [],
      lastDeliverySimMs: null,
      allDone: false,
    },
  };
}

// ── Public API ──

export interface InitParams {
  publisherNodeId: string;
  nodes: { id: string; neighbors: string[] }[];
  edges: Edge[];
  k: number;
  redundancyFactor: number;
  packetLoss: number; // 0-100
}

/**
 * Reset all engine state and seed initial events for both protocols.
 */
export function initPropagation(params: InitParams): void {
  const { publisherNodeId, nodes, edges, k, redundancyFactor, packetLoss } = params;

  // Clear everything
  eventQueue.clear();
  rlncTrackers.clear();
  gossipReceived.clear();
  gossipForwarded.clear();
  rlncNodeDeliveryTime.clear();
  gossipNodeDeliveryTime.clear();
  metrics = emptyEngineMetrics();
  publisherId = publisherNodeId;
  simK = k;

  // Build edge lookup
  edgeLookup = new Map();
  for (const e of edges) {
    edgeLookup.set(`${e.source}->${e.target}`, e);
  }

  // Build subscriber list and rank trackers
  subscriberIds = [];
  for (const node of nodes) {
    if (node.id !== publisherNodeId) {
      subscriberIds.push(node.id);
      rlncTrackers.set(node.id, new IncrementalRankTracker(k));
    }
  }

  // Mark publisher as having the gossip message
  gossipReceived.add(publisherNodeId);
  gossipForwarded.add(publisherNodeId);

  const publisher = nodes.find((n) => n.id === publisherNodeId);
  if (!publisher) return;

  const lossRate = packetLoss / 100;
  const totalShards = Math.ceil(k * redundancyFactor);

  // ── RLNC: publisher sends coded shards to all neighbors ──
  for (let s = 0; s < totalShards; s++) {
    const codingVector = Array.from({ length: k }, () => gfRandom(random));

    for (const neighborId of publisher.neighbors) {
      const edge = edgeLookup.get(`${publisherNodeId}->${neighborId}`);
      if (!edge) continue;

      const dropped = random() < lossRate;
      // Stagger shards by 0.3ms each — small shards serialize quickly
      const arriveAt = edge.latencyMs + s * 0.3;

      eventQueue.push({
        fireAt: arriveAt,
        seq: 0,
        protocol: 'rlnc',
        type: 'shard_arrive',
        fromNode: publisherNodeId,
        toNode: neighborId,
        shardIndex: s,
        codingVector: [...codingVector],
        dropped,
      });
    }
  }

  // ── GossipSub: publisher sends full message to all neighbors ──
  for (const neighborId of publisher.neighbors) {
    const edge = edgeLookup.get(`${publisherNodeId}->${neighborId}`);
    if (!edge) continue;

    const dropped = random() < lossRate;
    eventQueue.push({
      fireAt: edge.latencyMs,
      seq: 0,
      protocol: 'gossipsub',
      type: 'message_arrive',
      fromNode: publisherNodeId,
      toNode: neighborId,
      dropped,
    });
  }
}

/**
 * Process all events with fireAt <= simTimeMs.
 * Returns new particles to animate and updated metrics.
 */
export function advanceTo(
  simTimeMs: number,
  packetLoss: number,
  nodes: { id: string; neighbors: string[] }[],
): {
  newParticles: AnimatedParticle[];
  metrics: EngineMetrics;
} {
  const newParticles: AnimatedParticle[] = [];
  const lossRate = packetLoss / 100;

  while (eventQueue.length > 0 && eventQueue.peek()!.fireAt <= simTimeMs) {
    const event = eventQueue.pop()!;

    if (event.protocol === 'rlnc') {
      processRLNC(event, lossRate, nodes, newParticles);
    } else {
      processGossip(event, lossRate, nodes, newParticles);
    }
  }

  // Check completion
  metrics.rlnc.allDone =
    subscriberIds.length > 0 &&
    subscriberIds.every((id) => rlncTrackers.get(id)?.isFullRank ?? false);

  metrics.gossipsub.allDone =
    subscriberIds.length > 0 &&
    subscriberIds.every((id) => gossipReceived.has(id));

  // Compute last delivery times (max across all nodes that DID receive)
  // Always update — don't wait for allDone, so partial delivery still shows latency
  if (rlncNodeDeliveryTime.size > 0) {
    let maxTime = 0;
    for (const t of rlncNodeDeliveryTime.values()) {
      if (t > maxTime) maxTime = t;
    }
    metrics.rlnc.lastDeliverySimMs = Math.round(maxTime * 10) / 10;
  }

  if (gossipNodeDeliveryTime.size > 0) {
    let maxTime = 0;
    for (const t of gossipNodeDeliveryTime.values()) {
      if (t > maxTime) maxTime = t;
    }
    metrics.gossipsub.lastDeliverySimMs = Math.round(maxTime * 10) / 10;
  }

  return { newParticles, metrics: { ...metrics } };
}

// ── RLNC event processing ──

function processRLNC(
  event: SimEvent,
  lossRate: number,
  nodes: { id: string; neighbors: string[] }[],
  newParticles: AnimatedParticle[],
): void {
  metrics.rlnc.totalTransmissions++;

  // Create particle regardless (dropped ones shown faded)
  const edge = edgeLookup.get(`${event.fromNode}->${event.toNode}`);
  newParticles.push({
    id: `rlnc-${event.fromNode}-${event.toNode}-${event.shardIndex}-${event.fireAt}`,
    protocol: 'rlnc',
    fromNode: event.fromNode,
    toNode: event.toNode,
    progress: 0,
    duration: edge?.latencyMs ?? 30,
    startTime: event.fireAt - (edge?.latencyMs ?? 30),
    shardIndex: event.shardIndex,
    dropped: event.dropped,
  });

  if (event.dropped) return;

  const tracker = rlncTrackers.get(event.toNode);
  if (!tracker || tracker.isFullRank) return;

  const wasUseful = tracker.addRow(event.codingVector!);
  if (wasUseful) {
    metrics.rlnc.usefulTransmissions++;
  }

  // Record delivery time for this node
  if (tracker.isFullRank && !rlncNodeDeliveryTime.has(event.toNode)) {
    rlncNodeDeliveryTime.set(event.toNode, event.fireAt);
    metrics.rlnc.deliveredNodes.push(event.toNode);
  }

  // Recode and forward to neighbors (relay behavior)
  const node = nodes.find((n) => n.id === event.toNode);
  if (!node) return;

  for (const neighborId of node.neighbors) {
    if (neighborId === event.fromNode) continue;
    if (neighborId === publisherId) continue;
    const neighborTracker = rlncTrackers.get(neighborId);
    if (neighborTracker?.isFullRank) continue;

    const neighborEdge = edgeLookup.get(`${event.toNode}->${neighborId}`);
    if (!neighborEdge) continue;

    // Recode: fresh random coding vector
    const recodedVector = Array.from({ length: simK }, () => gfRandom(random));
    const dropped = random() < lossRate;

    eventQueue.push({
      fireAt: event.fireAt + neighborEdge.latencyMs + 0.5, // +0.5ms recode delay
      seq: 0,
      protocol: 'rlnc',
      type: 'shard_arrive',
      fromNode: event.toNode,
      toNode: neighborId,
      shardIndex: event.shardIndex,
      codingVector: recodedVector,
      dropped,
    });
  }
}

// ── GossipSub event processing ──

function processGossip(
  event: SimEvent,
  lossRate: number,
  nodes: { id: string; neighbors: string[] }[],
  newParticles: AnimatedParticle[],
): void {
  metrics.gossipsub.totalTransmissions++;

  const edge = edgeLookup.get(`${event.fromNode}->${event.toNode}`);
  newParticles.push({
    id: `gossip-${event.fromNode}-${event.toNode}-${event.fireAt}`,
    protocol: 'gossipsub',
    fromNode: event.fromNode,
    toNode: event.toNode,
    progress: 0,
    duration: edge?.latencyMs ?? 30,
    startTime: event.fireAt - (edge?.latencyMs ?? 30),
    dropped: event.dropped,
  });

  if (event.dropped) return;

  if (gossipReceived.has(event.toNode)) {
    // Duplicate delivery
    metrics.gossipsub.duplicates++;
    return;
  }

  // First delivery
  metrics.gossipsub.usefulTransmissions++;
  gossipReceived.add(event.toNode);
  gossipNodeDeliveryTime.set(event.toNode, event.fireAt);
  metrics.gossipsub.deliveredNodes.push(event.toNode);

  // Forward to all neighbors except sender (if not already forwarded)
  if (gossipForwarded.has(event.toNode)) return;
  gossipForwarded.add(event.toNode);

  const node = nodes.find((n) => n.id === event.toNode);
  if (!node) return;

  for (const neighborId of node.neighbors) {
    if (neighborId === event.fromNode) continue;

    const neighborEdge = edgeLookup.get(`${event.toNode}->${neighborId}`);
    if (!neighborEdge) continue;

    const dropped = random() < lossRate;
    // Store-and-forward: relay must receive FULL message, validate, then re-serialize.
    // This takes time proportional to message size (~k shards worth of data).
    // RLNC relays only need one shard to recode and forward (0.5ms).
    const storeForwardDelay = simK * 1.5 + 1; // receive + validate + re-serialize
    eventQueue.push({
      fireAt: event.fireAt + neighborEdge.latencyMs + storeForwardDelay,
      seq: 0,
      protocol: 'gossipsub',
      type: 'message_arrive',
      fromNode: event.toNode,
      toNode: neighborId,
      dropped,
    });
  }
}

// ── Query helpers ──

export function hasRemainingEvents(): boolean {
  return eventQueue.length > 0;
}

export function nextEventTime(): number | null {
  const next = eventQueue.peek();
  return next ? next.fireAt : null;
}

export function getRLNCRank(nodeId: string): number {
  return rlncTrackers.get(nodeId)?.rank ?? 0;
}

export function isRLNCReconstructed(nodeId: string): boolean {
  return rlncTrackers.get(nodeId)?.isFullRank ?? false;
}

export function hasGossipMessage(nodeId: string): boolean {
  return gossipReceived.has(nodeId);
}

export function getEngineMetrics(): EngineMetrics {
  return { ...metrics };
}

export function clearEngine(): void {
  eventQueue.clear();
  rlncTrackers.clear();
  gossipReceived.clear();
  gossipForwarded.clear();
  rlncNodeDeliveryTime.clear();
  gossipNodeDeliveryTime.clear();
  metrics = emptyEngineMetrics();
  subscriberIds = [];
  publisherId = null;
}
