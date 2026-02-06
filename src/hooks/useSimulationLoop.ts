'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDashboardStore } from '@/store';
import {
  initPropagation,
  advanceTo,
  hasRemainingEvents,
  clearEngine,
  nextEventTime,
} from '@/simulation/engine';

/**
 * Drives the simulation via requestAnimationFrame.
 *
 * Maintains a `simTime` counter (simulated ms, starting at 0).
 * Each frame advances simTime by `realDeltaMs * speed`, then processes
 * all engine events up to that point and updates particle positions.
 */
export function useSimulationLoop() {
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const tick = useCallback((timestamp: number) => {
    const store = useDashboardStore.getState();
    if (!store.running || !store.publisherNodeId) {
      rafRef.current = null;
      return;
    }

    // Initialize engine on first tick after startPropagation
    if (!initializedRef.current) {
      initPropagation({
        publisherNodeId: store.publisherNodeId,
        nodes: store.nodes,
        edges: store.edges,
        k: store.k,
        redundancyFactor: store.redundancyFactor,
        packetLoss: store.packetLoss,
      });
      initializedRef.current = true;
      lastFrameRef.current = timestamp;
    }

    // Compute real elapsed time and advance simulated time
    const realDeltaMs = Math.min(timestamp - lastFrameRef.current, 50); // Cap at 50ms to avoid spiral
    lastFrameRef.current = timestamp;

    const simDelta = realDeltaMs * store.speed;
    const newSimTime = store.simTime + simDelta;

    // Process engine events up to newSimTime
    const { newParticles, metrics } = advanceTo(
      newSimTime,
      store.packetLoss,
      store.nodes,
    );

    // Update particle progress based on simulated time
    const allParticles = [...store.particles, ...newParticles];
    const updatedParticles = allParticles
      .map((p) => {
        const simElapsed = newSimTime - p.startTime;
        const progress = Math.min(1, simElapsed / p.duration);
        return { ...p, progress };
      })
      .filter((p) => p.progress < 1);

    // Push updates to store
    store.setSimTime(newSimTime);
    store.updateParticles(updatedParticles);
    store.pushEngineMetrics(metrics);

    // Check if simulation is complete
    const bothDone = metrics.rlnc.allDone && metrics.gossipsub.allDone;
    const noMoreEvents = !hasRemainingEvents();
    const noMoreParticles = updatedParticles.length === 0;

    if ((bothDone && noMoreParticles) || (noMoreEvents && noMoreParticles && newSimTime > 5000)) {
      store.setSimulationDone(true);
      initializedRef.current = false;
      rafRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Step forward: advance to the next event time
  const stepForward = useCallback(() => {
    const store = useDashboardStore.getState();
    if (!store.publisherNodeId) return;

    // Initialize if needed
    if (!initializedRef.current) {
      initPropagation({
        publisherNodeId: store.publisherNodeId,
        nodes: store.nodes,
        edges: store.edges,
        k: store.k,
        redundancyFactor: store.redundancyFactor,
        packetLoss: store.packetLoss,
      });
      initializedRef.current = true;
    }

    const nextTime = nextEventTime();
    if (nextTime === null) return;

    const targetSimTime = nextTime + 0.001; // Just past the event

    const { newParticles, metrics } = advanceTo(
      targetSimTime,
      store.packetLoss,
      store.nodes,
    );

    const allParticles = [...store.particles, ...newParticles];
    const updatedParticles = allParticles
      .map((p) => {
        const simElapsed = targetSimTime - p.startTime;
        const progress = Math.min(1, simElapsed / p.duration);
        return { ...p, progress };
      })
      .filter((p) => p.progress < 1);

    store.setSimTime(targetSimTime);
    store.updateParticles(updatedParticles);
    store.pushEngineMetrics(metrics);

    if (metrics.rlnc.allDone && metrics.gossipsub.allDone && !hasRemainingEvents()) {
      store.setSimulationDone(true);
      initializedRef.current = false;
    }
  }, []);

  const running = useDashboardStore((s) => s.running);
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);

  useEffect(() => {
    if (running && publisherNodeId) {
      lastFrameRef.current = performance.now();
      if (!initializedRef.current) {
        // Will initialize on first tick
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running, publisherNodeId, tick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearEngine();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { stepForward };
}
