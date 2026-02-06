'use client';

import dynamic from 'next/dynamic';
import { useSimulationLoop } from '@/hooks/useSimulationLoop';
import ControlPanel from '@/components/controls/ControlPanel';
import MetricsPanel from '@/components/metrics/MetricsPanel';
import { useDashboardStore } from '@/store';
import { ACCENT_TEAL, BG_PRIMARY, BG_PANEL, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/colors';

const NetworkCanvas = dynamic(
  () => import('@/components/canvas/NetworkCanvas'),
  { ssr: false },
);

export default function Home() {
  const { stepForward } = useSimulationLoop();

  const running = useDashboardStore((s) => s.running);
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
        <div className="flex items-center gap-4">
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
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Controls */}
        <aside className="w-72 flex-shrink-0 border-r border-[#1e2840] overflow-hidden">
          <ControlPanel onStep={stepForward} />
        </aside>

        {/* Center — Canvas */}
        <main className="flex-1 relative overflow-hidden">
          <NetworkCanvas />

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
              {simulationDone ? 'Reset to run again' : 'Click any node to start propagation'}
            </p>
          </div>
        </main>

        {/* Right sidebar — Metrics */}
        <aside className="w-72 flex-shrink-0 border-l border-[#1e2840] overflow-hidden">
          <MetricsPanel />
        </aside>
      </div>
    </div>
  );
}
