'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDashboardStore } from '@/store';
import {
  initPropagation,
  processEvents,
  getPropagationStartTs,
  hasRemainingEvents,
  clearEvents,
} from '@/simulation/engine';

/**
 * Drives the simulation via requestAnimationFrame.
 * Processes scheduled events and updates particle positions.
 */
export function useSimulationLoop() {
  const rafRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const tick = useCallback(() => {
    const store = useDashboardStore.getState();
    if (!store.running || !store.publisherNodeId) {
      rafRef.current = null;
      return;
    }

    // Initialize propagation on first tick
    if (!initializedRef.current) {
      initPropagation(store);
      initializedRef.current = true;
    }

    const now = performance.now();
    const startTs = getPropagationStartTs();

    // Process events
    const {
      newParticles,
      rlncReconstructed,
      gossipDelivered,
      rlncAllDone,
      gossipAllDone,
    } = processEvents(now, store);

    // Add new particles
    if (newParticles.length > 0) {
      const currentParticles = useDashboardStore.getState().particles;
      store.updateParticles([...currentParticles, ...newParticles]);
    }

    // Update existing particle progress
    const updatedParticles = useDashboardStore
      .getState()
      .particles.map((p) => {
        const elapsed = now - p.startTime;
        const progress = Math.min(1, elapsed / (p.duration * (1 / store.speed)));
        return { ...p, progress };
      })
      .filter((p) => p.progress < 1); // Remove completed particles

    store.updateParticles(updatedParticles);

    // Check RLNC completion
    if (rlncAllDone && store.rlncDeliveryTime === null) {
      const deliveryMs = Math.round(now - startTs);
      store.setRLNCDeliveryTime(deliveryMs);
    }

    // Check GossipSub completion
    if (gossipAllDone && store.gossipDeliveryTime === null) {
      const deliveryMs = Math.round(now - startTs);
      store.setGossipDeliveryTime(deliveryMs);
    }

    // Stop if both done and no more events/particles
    if (rlncAllDone && gossipAllDone && !hasRemainingEvents() && updatedParticles.length === 0) {
      store.setRunning(false);
      initializedRef.current = false;
      rafRef.current = null;
      return;
    }

    // Stop if no events left and we've waited long enough
    if (!hasRemainingEvents() && updatedParticles.length === 0 && now - startTs > 10000) {
      store.setRunning(false);
      initializedRef.current = false;
      rafRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const running = useDashboardStore((s) => s.running);
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);

  useEffect(() => {
    if (running && publisherNodeId) {
      initializedRef.current = false;
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
      clearEvents();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);
}
