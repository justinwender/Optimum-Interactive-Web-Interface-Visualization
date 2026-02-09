/**
 * Discrete-event simulation engine.
 *
 * All times are in **simulated milliseconds** (starting from 0).
 * The animation loop advances simTime and calls `advanceTo(simTime)`
 * to process events that have fired.
 *
 * Both protocols share the same timeline for fair comparison.
 *
 * Key behaviors:
 * - RLNC: Publisher sends loss-compensated burst. Relays continuously
 *   generate new coded shards (2 per incoming) and schedule periodic
 *   recode pushes. This models real RLNC's continuous coding.
 * - GossipSub: Store-and-forward with heartbeat-based retransmission.
 *   Nodes retry sending to neighbors that haven't received, modeling
 *   the IHAVE/IWANT gossip protocol.
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
// Track per-node last duplicate arrival simTime (for UI flash effect)
const gossipLastDuplicateSimTime = new Map<string, number>();
// Track per-node last redundant RLNC shard arrival simTime
const rlncLastRedundantSimTime = new Map<string, number>();

// Edges lookup for fast access
let edgeLookup = new Map<string, Edge>();

// Per-node last RLNC reconstruction time (simulated ms)
const rlncNodeDeliveryTime = new Map<string, number>();
// Per-node last GossipSub delivery time (simulated ms)
const gossipNodeDeliveryTime = new Map<string, number>();

// RLNC: track how many recode rounds each relay has done (cap to prevent explosion)
const rlncRecodePushes = new Map<string, number>();
const MAX_RLNC_PUSHES_PER_NODE = 12; // max recode push rounds per relay
const RLNC_PUSH_INTERVAL = 3; // ms between push rounds

// GossipSub: track retry count per node
const gossipRetries = new Map<string, number>();
const MAX_GOSSIP_RETRIES = 4;
const GOSSIP_RETRY_INTERVAL = 80; // ms between retries

// Publisher periodic resend times (sim ms) — ensures delivery under high loss
const PUBLISHER_RESEND_TIMES = [100, 250, 500];

// Accumulated metrics
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
let simLossRate = 0;
let simNodes: { id: string; neighbors: string[] }[] = [];

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
  rlncRecodePushes.clear();
  gossipRetries.clear();
  gossipLastDuplicateSimTime.clear();
  rlncLastRedundantSimTime.clear();
  metrics = emptyEngineMetrics();
  publisherId = publisherNodeId;
  simK = k;
  simLossRate = packetLoss / 100;
  simNodes = nodes;

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

  const lossRate = simLossRate;

  // ── RLNC: publisher sends coded shards, compensating for packet loss ──
  // Real RLNC publishers continuously generate coded shards. We model this
  // as an initial burst scaled by loss rate, ensuring enough shards survive.
  const lossCompensation = lossRate > 0 ? 1 / Math.max(1 - lossRate, 0.15) : 1;
  const totalShards = Math.min(
    Math.ceil(k * redundancyFactor * lossCompensation),
    k * 6, // cap to prevent excessive events
  );

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

  // ── GossipSub: publisher retries (models heartbeat retransmission) ──
  for (let retry = 1; retry <= MAX_GOSSIP_RETRIES; retry++) {
    for (const neighborId of publisher.neighbors) {
      const edge = edgeLookup.get(`${publisherNodeId}->${neighborId}`);
      if (!edge) continue;

      const dropped = random() < lossRate;
      eventQueue.push({
        fireAt: edge.latencyMs + retry * GOSSIP_RETRY_INTERVAL,
        seq: 0,
        protocol: 'gossipsub',
        type: 'message_arrive',
        fromNode: publisherNodeId,
        toNode: neighborId,
        dropped,
      });
    }
  }

  // ── Publisher periodic resend rounds (both protocols) ──
  // Ensures delivery under high loss by sending fresh bursts at intervals.
  for (const resendTime of PUBLISHER_RESEND_TIMES) {
    // RLNC resend: fresh coded shards
    const resendShards = Math.ceil(k * 1.5);
    for (let s = 0; s < resendShards; s++) {
      const codingVector = Array.from({ length: k }, () => gfRandom(random));
      for (const neighborId of publisher.neighbors) {
        const edge = edgeLookup.get(`${publisherNodeId}->${neighborId}`);
        if (!edge) continue;
        const dropped = random() < lossRate;
        eventQueue.push({
          fireAt: resendTime + edge.latencyMs + s * 0.3,
          seq: 0,
          protocol: 'rlnc',
          type: 'shard_arrive',
          fromNode: publisherNodeId,
          toNode: neighborId,
          shardIndex: 1000 + resendTime + s,
          codingVector: [...codingVector],
          dropped,
        });
      }
    }

    // GossipSub resend
    for (const neighborId of publisher.neighbors) {
      const edge = edgeLookup.get(`${publisherNodeId}->${neighborId}`);
      if (!edge) continue;
      const dropped = random() < lossRate;
      eventQueue.push({
        fireAt: resendTime + edge.latencyMs,
        seq: 0,
        protocol: 'gossipsub',
        type: 'message_arrive',
        fromNode: publisherNodeId,
        toNode: neighborId,
        dropped,
      });
    }
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

  // Create particle for visual animation.
  // Start at current simTime and use an extended duration so the particle
  // is visible for many frames (the actual delivery already happened).
  const edge = edgeLookup.get(`${event.fromNode}->${event.toNode}`);
  const visualDuration = Math.max((edge?.latencyMs ?? 30) * 10, 500);
  const tracker = rlncTrackers.get(event.toNode);
  const isRedundant = !event.dropped && (tracker?.isFullRank ?? false);
  newParticles.push({
    id: `rlnc-${event.fromNode}-${event.toNode}-${event.shardIndex}-${event.fireAt}`,
    protocol: 'rlnc',
    fromNode: event.fromNode,
    toNode: event.toNode,
    progress: 0,
    duration: visualDuration,
    startTime: event.fireAt,
    shardIndex: event.shardIndex,
    dropped: event.dropped,
    isRedundant,
  });

  if (event.dropped) return;

  if (!tracker || tracker.isFullRank) {
    // Record time for UI redundancy indicator
    if (tracker?.isFullRank) {
      rlncLastRedundantSimTime.set(event.toNode, event.fireAt);
    }
    return;
  }

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
  // In real RLNC, relays continuously generate new coded shards.
  // We model this by sending 2 coded shards per incoming shard,
  // plus scheduling periodic recode pushes.
  const node = nodes.find((n) => n.id === event.toNode);
  if (!node) return;

  const pushCount = rlncRecodePushes.get(event.toNode) ?? 0;
  if (pushCount >= MAX_RLNC_PUSHES_PER_NODE) return;
  rlncRecodePushes.set(event.toNode, pushCount + 1);

  for (const neighborId of node.neighbors) {
    if (neighborId === event.fromNode) continue;
    if (neighborId === publisherId) continue;
    const neighborTracker = rlncTrackers.get(neighborId);
    if (neighborTracker?.isFullRank) continue;

    const neighborEdge = edgeLookup.get(`${event.toNode}->${neighborId}`);
    if (!neighborEdge) continue;

    // Send 2 coded shards: immediate recode + delayed push
    // This models continuous recoding behavior
    for (let batch = 0; batch < 2; batch++) {
      const recodedVector = Array.from({ length: simK }, () => gfRandom(random));
      const dropped = random() < lossRate;

      eventQueue.push({
        fireAt: event.fireAt + neighborEdge.latencyMs + 0.5 + batch * RLNC_PUSH_INTERVAL,
        seq: 0,
        protocol: 'rlnc',
        type: 'shard_arrive',
        fromNode: event.toNode,
        toNode: neighborId,
        shardIndex: (event.shardIndex ?? 0) + batch * 100,
        codingVector: recodedVector,
        dropped,
      });
    }
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
  const gVisualDuration = Math.max((edge?.latencyMs ?? 30) * 10, 500);
  const gIsRedundant = !event.dropped && gossipReceived.has(event.toNode);
  newParticles.push({
    id: `gossip-${event.fromNode}-${event.toNode}-${event.fireAt}`,
    protocol: 'gossipsub',
    fromNode: event.fromNode,
    toNode: event.toNode,
    progress: 0,
    duration: gVisualDuration,
    startTime: event.fireAt,
    dropped: event.dropped,
    isRedundant: gIsRedundant,
  });

  if (event.dropped) return;

  if (gossipReceived.has(event.toNode)) {
    // Duplicate delivery — record time for UI flash
    metrics.gossipsub.duplicates++;
    gossipLastDuplicateSimTime.set(event.toNode, event.fireAt);
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

  const storeForwardDelay = simK * 1.5 + 1;

  for (const neighborId of node.neighbors) {
    if (neighborId === event.fromNode) continue;

    const neighborEdge = edgeLookup.get(`${event.toNode}->${neighborId}`);
    if (!neighborEdge) continue;

    const dropped = random() < lossRate;
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

  // Schedule retransmission retries (models IHAVE/IWANT heartbeat)
  // Nodes that received the message retry to ALL neighbors in case
  // previous deliveries were dropped.
  const retryCount = gossipRetries.get(event.toNode) ?? 0;
  if (retryCount < MAX_GOSSIP_RETRIES) {
    gossipRetries.set(event.toNode, retryCount + 1);

    for (const neighborId of node.neighbors) {
      const neighborEdge = edgeLookup.get(`${event.toNode}->${neighborId}`);
      if (!neighborEdge) continue;

      const dropped = random() < lossRate;
      eventQueue.push({
        fireAt: event.fireAt + GOSSIP_RETRY_INTERVAL + neighborEdge.latencyMs + storeForwardDelay,
        seq: 0,
        protocol: 'gossipsub',
        type: 'message_arrive',
        fromNode: event.toNode,
        toNode: neighborId,
        dropped,
      });
    }
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

export function getGossipLastDuplicateTime(nodeId: string): number | null {
  return gossipLastDuplicateSimTime.get(nodeId) ?? null;
}

export function getRLNCLastRedundantTime(nodeId: string): number | null {
  return rlncLastRedundantSimTime.get(nodeId) ?? null;
}

export function clearEngine(): void {
  eventQueue.clear();
  rlncTrackers.clear();
  gossipReceived.clear();
  gossipForwarded.clear();
  rlncNodeDeliveryTime.clear();
  gossipNodeDeliveryTime.clear();
  rlncRecodePushes.clear();
  gossipRetries.clear();
  gossipLastDuplicateSimTime.clear();
  rlncLastRedundantSimTime.clear();
  metrics = emptyEngineMetrics();
  subscriberIds = [];
  publisherId = null;
  simNodes = [];
}
