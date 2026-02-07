'use client';

import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/store';
import type { ComparisonMode, NetworkPreset, TopologyType } from '@/simulation/types';

/**
 * Syncs simulation parameters with URL query string.
 *
 * On mount: reads URL params and applies them to the store.
 * On store change: updates URL (replaceState, no history pollution).
 *
 * Supported params: nodes, loss, preset, mode, topo, k, speed
 */
export function useUrlState() {
  const hasInitialized = useRef(false);

  // Read from URL on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const store = useDashboardStore.getState();

    const nodes = params.get('nodes');
    if (nodes) {
      const n = parseInt(nodes, 10);
      if (n >= 3 && n <= 50) store.setNodeCount(n);
    }

    const loss = params.get('loss');
    if (loss) {
      const l = parseInt(loss, 10);
      if (l >= 0 && l <= 50) store.setPacketLoss(l);
    }

    const preset = params.get('preset');
    if (preset && ['ethereum', 'solana', 'custom'].includes(preset)) {
      store.setNetworkPreset(preset as NetworkPreset);
    }

    const mode = params.get('mode');
    if (mode && ['click', 'continuous'].includes(mode)) {
      store.setComparisonMode(mode as ComparisonMode);
    }

    const topo = params.get('topo');
    if (topo && ['mesh', 'ring', 'star', 'random'].includes(topo)) {
      store.setTopology(topo as TopologyType);
    }

    const k = params.get('k');
    if (k) {
      const kVal = parseInt(k, 10);
      if (kVal >= 2 && kVal <= 16) store.setK(kVal);
    }

    const speed = params.get('speed');
    if (speed) {
      const s = parseFloat(speed);
      if (s >= 0.1 && s <= 10) store.setSpeed(s);
    }
  }, []);

  // Write to URL on relevant store changes
  const nodeCount = useDashboardStore((s) => s.nodeCount);
  const packetLoss = useDashboardStore((s) => s.packetLoss);
  const networkPreset = useDashboardStore((s) => s.networkPreset);
  const comparisonMode = useDashboardStore((s) => s.comparisonMode);
  const topology = useDashboardStore((s) => s.topology);
  const k = useDashboardStore((s) => s.k);
  const speed = useDashboardStore((s) => s.speed);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    params.set('nodes', String(nodeCount));
    params.set('loss', String(packetLoss));
    params.set('preset', networkPreset);
    params.set('mode', comparisonMode);
    params.set('topo', topology);
    params.set('k', String(k));
    params.set('speed', String(speed));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [nodeCount, packetLoss, networkPreset, comparisonMode, topology, k, speed]);
}
