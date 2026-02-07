'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useSimulationLoop } from '@/hooks/useSimulationLoop';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUrlState } from '@/hooks/useUrlState';
import ControlPanel from '@/components/controls/ControlPanel';
import MetricsPanel from '@/components/metrics/MetricsPanel';
import RaceTimer from '@/components/canvas/RaceTimer';
import SlotTimeline from '@/components/canvas/SlotTimeline';
import { useDashboardStore } from '@/store';
import { ACCENT_TEAL, GOSSIP_COLOR, BG_PRIMARY, BG_PANEL, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/colors';

const NetworkCanvas = dynamic(
  () => import('@/components/canvas/NetworkCanvas'),
  { ssr: false },
);

const GlobeView = dynamic(
  () => import('@/components/canvas/GlobeView'),
  { ssr: false },
);

type ViewMode = '2d' | '3d';

export default function Home() {
  const { stepForward, cancelAutoRestart } = useSimulationLoop();
  useKeyboardShortcuts(stepForward);
  useUrlState();

  const [viewMode, setViewMode] = useState<ViewMode>('2d');

  const running = useDashboardStore((s) => s.running);
  const comparisonMode = useDashboardStore((s) => s.comparisonMode);
  const nodeCount = useDashboardStore((s) => s.nodeCount);
  const packetLoss = useDashboardStore((s) => s.packetLoss);
  const networkPreset = useDashboardStore((s) => s.networkPreset);
  const simTime = useDashboardStore((s) => s.simTime);
  const simulationDone = useDashboardStore((s) => s.simulationDone);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: BG_PRIMARY }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b border-[#1e2840]"
        style={{ backgroundColor: BG_PANEL }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: ACCENT_TEAL, color: '#000' }}
          >
            O
          </div>
          <div>
            <h1 className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>
              mump2p Dashboard
            </h1>
            <p className="text-[10px]" style={{ color: TEXT_SECONDARY }}>
              RLNC vs GossipSub — Interactive Network Visualization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-full overflow-hidden border border-[#2a3450]">
            <button
              onClick={() => setViewMode('2d')}
              className="text-[10px] px-2.5 py-1 font-medium transition-colors"
              style={{
                backgroundColor: viewMode === '2d' ? ACCENT_TEAL : '#1e2840',
                color: viewMode === '2d' ? '#000' : TEXT_SECONDARY,
              }}
              aria-label="Switch to 2D split view"
            >
              2D Split
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className="text-[10px] px-2.5 py-1 font-medium transition-colors"
              style={{
                backgroundColor: viewMode === '3d' ? ACCENT_TEAL : '#1e2840',
                color: viewMode === '3d' ? '#000' : TEXT_SECONDARY,
              }}
              aria-label="Switch to 3D globe view"
            >
              3D Globe
            </button>
          </div>
          <span
            className="text-[10px] px-2.5 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${ACCENT_TEAL}15`,
              color: ACCENT_TEAL,
              border: `1px solid ${ACCENT_TEAL}30`,
            }}
          >
            {networkPreset.charAt(0).toUpperCase() + networkPreset.slice(1)}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              const btn = document.getElementById('copy-link-btn');
              if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Share Link'; }, 1500); }
            }}
            id="copy-link-btn"
            aria-label="Copy shareable link to clipboard"
            className="text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors hover:brightness-110"
            style={{
              backgroundColor: '#1e2840',
              color: TEXT_SECONDARY,
              border: '1px solid #2a3450',
            }}
          >
            Share Link
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Controls */}
        <aside className="w-72 flex-shrink-0 border-r border-[#1e2840] overflow-hidden" role="complementary" aria-label="Simulation controls">
          <ControlPanel onStep={stepForward} onReset={cancelAutoRestart} />
        </aside>

        {/* Center — Canvas area */}
        <main className="flex-1 flex flex-col overflow-hidden relative" role="main" aria-label="Network visualization">
          {/* Slot Timeline — visible in continuous mode */}
          <SlotTimeline />

          {viewMode === '2d' ? (
            /* 2D Split Canvas */
            <div className="flex flex-1 overflow-hidden">
              {/* RLNC Canvas */}
              <div className="flex-1 flex flex-col border-r border-[#1e2840]" role="region" aria-label="mump2p RLNC network visualization">
                <div
                  className="px-3 py-1.5 border-b border-[#1e2840] flex items-center justify-center gap-2"
                  style={{ backgroundColor: `${BG_PANEL}CC` }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ACCENT_TEAL }}
                  />
                  <span
                    className="text-[11px] font-semibold tracking-wide"
                    style={{ color: ACCENT_TEAL }}
                  >
                    mump2p (RLNC)
                  </span>
                </div>
                <div className="flex-1 relative">
                  <NetworkCanvas protocol="rlnc" />
                  <RaceTimer protocol="rlnc" />
                </div>
              </div>

              {/* GossipSub Canvas */}
              <div className="flex-1 flex flex-col" role="region" aria-label="GossipSub network visualization">
                <div
                  className="px-3 py-1.5 border-b border-[#1e2840] flex items-center justify-center gap-2"
                  style={{ backgroundColor: `${BG_PANEL}CC` }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: GOSSIP_COLOR }}
                  />
                  <span
                    className="text-[11px] font-semibold tracking-wide"
                    style={{ color: GOSSIP_COLOR }}
                  >
                    GossipSub
                  </span>
                </div>
                <div className="flex-1 relative">
                  <NetworkCanvas protocol="gossipsub" />
                  <RaceTimer protocol="gossipsub" />
                </div>
              </div>
            </div>
          ) : (
            /* 3D Globe View */
            <div className="flex-1 relative" role="region" aria-label="3D globe network visualization">
              <GlobeView />
              <RaceTimer protocol="rlnc" />
            </div>
          )}

          {/* Status bar overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 border-t border-[#1e2840]"
            style={{ backgroundColor: `${BG_PANEL}E6` }}
          >
            <div className="flex items-center gap-3 text-[10px]" style={{ color: TEXT_SECONDARY }}>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: running ? ACCENT_TEAL : simulationDone ? '#00E676' : '#4A5568' }}
                />
                {running ? 'Running' : simulationDone ? 'Complete' : 'Idle'}
              </span>
              <span>{nodeCount} nodes</span>
              <span>{packetLoss}% loss</span>
              {simTime > 0 && <span className="font-mono">{simTime.toFixed(1)}ms sim</span>}
            </div>
            <p className="text-[10px]" style={{ color: TEXT_SECONDARY }}>
              {simulationDone
                ? (comparisonMode === 'continuous' ? 'Next round starting...' : 'Press R to reset')
                : (comparisonMode === 'click' ? 'Click a node to simulate block proposal' : 'Press Space to pause')}
            </p>
          </div>
        </main>

        {/* Right sidebar — Metrics */}
        <aside className="w-72 flex-shrink-0 border-l border-[#1e2840] overflow-hidden" role="complementary" aria-label="Simulation metrics">
          <MetricsPanel />
        </aside>
      </div>
    </div>
  );
}
