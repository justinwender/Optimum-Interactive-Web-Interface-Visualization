/**
 * Simulation engine: schedules shard/message propagation for both protocols
 * and drives the animation loop.
 */

import type { AnimatedParticle, Edge, FlexNode } from './types';
import { gfRandom } from '@/lib/galoisField';
import { IncrementalRankTracker } from '@/lib/gaussianElimination';
import { random } from '@/lib/prng';
import type { DashboardState } from '@/store';

interface ScheduledEvent {
  fireAt: number; // timestamp (ms) when this event should fire
  protocol: 'rlnc' | 'gossipsub';
  fromNode: string;
  toNode: string;
  shardIndex?: number;
  codingVector?: number[];
  dropped: boolean;
}

let eventQueue: ScheduledEvent[] = [];
let rlncRankTrackers: Map<string, IncrementalRankTracker> = new Map();
let propagationStartTs = 0;

/**
 * Initialize and kick off propagation from a publisher node.
 * Call this once when the user clicks a node or when continuous mode fires.
 */
export function initPropagation(store: DashboardState): void {
  const {
    publisherNodeId,
    nodes,
    edges,
    k,
    redundancyFactor,
    packetLoss,
  } = store;

  if (!publisherNodeId) return;

  eventQueue = [];
  rlncRankTrackers = new Map();
  propagationStartTs = performance.now();

  // Initialize rank trackers for all non-publisher nodes
  for (const node of nodes) {
    if (node.id !== publisherNodeId) {
      rlncRankTrackers.set(node.id, new IncrementalRankTracker(k));
    }
  }

  const publisher = nodes.find((n) => n.id === publisherNodeId);
  if (!publisher) return;

  const totalShards = Math.ceil(k * redundancyFactor);

  // ── RLNC: publisher sends coded shards to all neighbors ──
  for (let s = 0; s < totalShards; s++) {
    // Generate random coding vector
    const codingVector = Array.from({ length: k }, () => gfRandom(random));

    for (const neighborId of publisher.neighbors) {
      const edge = findEdge(edges, publisherNodeId, neighborId);
      if (!edge) continue;

      const dropped = random() < (packetLoss / 100);
      eventQueue.push({
        fireAt: propagationStartTs + edge.latencyMs + s * 2, // stagger shards slightly
        protocol: 'rlnc',
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
    const edge = findEdge(edges, publisherNodeId, neighborId);
    if (!edge) continue;

    const dropped = random() < (packetLoss / 100);
    eventQueue.push({
      fireAt: propagationStartTs + edge.latencyMs,
      protocol: 'gossipsub',
      fromNode: publisherNodeId,
      toNode: neighborId,
      dropped,
    });
  }

  // Sort by fire time
  eventQueue.sort((a, b) => a.fireAt - b.fireAt);
}

/**
 * Process events that should fire by `now` and return new particles to animate.
 * Also returns state updates (node reconstructions, delivery times, etc).
 */
export function processEvents(
  now: number,
  store: DashboardState,
): {
  newParticles: AnimatedParticle[];
  rlncReconstructed: string[];
  gossipDelivered: string[];
  rlncAllDone: boolean;
  gossipAllDone: boolean;
} {
  const newParticles: AnimatedParticle[] = [];
  const rlncReconstructed: string[] = [];
  const gossipDelivered: string[] = [];
  const toProcess: ScheduledEvent[] = [];

  // Collect events that should fire
  while (eventQueue.length > 0 && eventQueue[0].fireAt <= now) {
    toProcess.push(eventQueue.shift()!);
  }

  for (const event of toProcess) {
    if (event.protocol === 'rlnc') {
      processRLNCEvent(event, store, newParticles, rlncReconstructed);
    } else {
      processGossipEvent(event, store, newParticles, gossipDelivered);
    }
  }

  const { subscriberNodeIds } = store;

  const rlncAllDone =
    subscriberNodeIds.length > 0 &&
    subscriberNodeIds.every((id) => {
      const tracker = rlncRankTrackers.get(id);
      return tracker?.isFullRank ?? false;
    });

  const gossipAllDone =
    subscriberNodeIds.length > 0 &&
    subscriberNodeIds.every((id) => {
      const state = store.gossipStates.get(id);
      return state?.hasMessage ?? false;
    });

  return { newParticles, rlncReconstructed, gossipDelivered, rlncAllDone, gossipAllDone };
}

function processRLNCEvent(
  event: ScheduledEvent,
  store: DashboardState,
  newParticles: AnimatedParticle[],
  rlncReconstructed: string[],
): void {
  const { nodes, edges, k, packetLoss } = store;

  store.incrementRLNCTransmissions(false); // Will correct to useful below

  if (event.dropped) return;

  const tracker = rlncRankTrackers.get(event.toNode);
  if (!tracker || tracker.isFullRank) return;

  const wasUseful = tracker.addRow(event.codingVector!);
  if (wasUseful) {
    // Retroactively mark as useful (we already incremented total)
    store.incrementRLNCTransmissions(true);
    // Decrement total to correct double-count, then re-increment
    // Actually let's just track useful separately — the increment above counted total.
  }

  // Create animation particle
  const edge = findEdge(edges, event.fromNode, event.toNode);
  newParticles.push({
    id: `rlnc-${event.fromNode}-${event.toNode}-${event.shardIndex}-${Date.now()}`,
    protocol: 'rlnc',
    fromNode: event.fromNode,
    toNode: event.toNode,
    progress: 0,
    duration: edge?.latencyMs ?? 30,
    startTime: event.fireAt - (edge?.latencyMs ?? 30),
    shardIndex: event.shardIndex,
    dropped: false,
  });

  // Update node state
  const rlncState = store.rlncStates.get(event.toNode);
  if (rlncState) {
    store.setRLNCState(event.toNode, {
      ...rlncState,
      shardsReceived: rlncState.shardsReceived + 1,
      rank: tracker.rank,
      firstShardTick: rlncState.firstShardTick ?? event.fireAt,
      reconstructed: tracker.isFullRank,
      reconstructionTick: tracker.isFullRank
        ? event.fireAt
        : rlncState.reconstructionTick,
    });
  }

  if (tracker.isFullRank) {
    rlncReconstructed.push(event.toNode);
  }

  // Recode and forward to neighbors (if not fully reconstructed before this)
  if (!tracker.isFullRank || wasUseful) {
    const node = nodes.find((n) => n.id === event.toNode);
    if (!node) return;

    for (const neighborId of node.neighbors) {
      if (neighborId === event.fromNode) continue;
      const neighborTracker = rlncRankTrackers.get(neighborId);
      if (neighborTracker?.isFullRank) continue;

      const neighborEdge = findEdge(edges, event.toNode, neighborId);
      if (!neighborEdge) continue;

      // Recode: generate new random coding vector (simulates recoding)
      const recodedVector = Array.from({ length: k }, () => gfRandom(random));
      const dropped = random() < (packetLoss / 100);

      eventQueue.push({
        fireAt: event.fireAt + neighborEdge.latencyMs + 0.5, // +0.5ms recode delay
        protocol: 'rlnc',
        fromNode: event.toNode,
        toNode: neighborId,
        shardIndex: event.shardIndex,
        codingVector: recodedVector,
        dropped,
      });
    }
    // Re-sort queue
    eventQueue.sort((a, b) => a.fireAt - b.fireAt);
  }
}

function processGossipEvent(
  event: ScheduledEvent,
  store: DashboardState,
  newParticles: AnimatedParticle[],
  gossipDelivered: string[],
): void {
  const { nodes, edges, packetLoss } = store;

  store.incrementGossipTransmissions(false);

  if (event.dropped) return;

  const gossipState = store.gossipStates.get(event.toNode);
  if (!gossipState) return;

  // Create animation particle
  const edge = findEdge(edges, event.fromNode, event.toNode);
  newParticles.push({
    id: `gossip-${event.fromNode}-${event.toNode}-${Date.now()}`,
    protocol: 'gossipsub',
    fromNode: event.fromNode,
    toNode: event.toNode,
    progress: 0,
    duration: edge?.latencyMs ?? 30,
    startTime: event.fireAt - (edge?.latencyMs ?? 30),
    dropped: false,
  });

  if (gossipState.hasMessage) {
    // Duplicate
    store.setGossipState(event.toNode, {
      ...gossipState,
      duplicatesReceived: gossipState.duplicatesReceived + 1,
    });
    return;
  }

  // First delivery
  store.incrementGossipTransmissions(true);
  store.setGossipState(event.toNode, {
    ...gossipState,
    hasMessage: true,
    receivedAtTick: event.fireAt,
  });
  gossipDelivered.push(event.toNode);

  // Forward to neighbors
  const node = nodes.find((n) => n.id === event.toNode);
  if (!node) return;

  for (const neighborId of node.neighbors) {
    if (neighborId === event.fromNode) continue;

    const neighborEdge = findEdge(edges, event.toNode, neighborId);
    if (!neighborEdge) continue;

    const dropped = random() < (packetLoss / 100);
    eventQueue.push({
      fireAt: event.fireAt + neighborEdge.latencyMs + 1, // +1ms processing
      protocol: 'gossipsub',
      fromNode: event.toNode,
      toNode: neighborId,
      dropped,
    });
  }
  eventQueue.sort((a, b) => a.fireAt - b.fireAt);
}

function findEdge(edges: Edge[], source: string, target: string): Edge | undefined {
  return edges.find((e) => e.source === source && e.target === target);
}

export function getPropagationStartTs(): number {
  return propagationStartTs;
}

export function hasRemainingEvents(): boolean {
  return eventQueue.length > 0;
}

export function clearEvents(): void {
  eventQueue = [];
  rlncRankTrackers = new Map();
}
