'use client';

import { useDashboardStore } from '@/store';
import { clearEngine } from '@/simulation/engine';
import type { ComparisonMode, NetworkPreset, TopologyType } from '@/simulation/types';
import { NETWORK_PRESETS } from '@/constants/defaults';
import { ACCENT_TEAL, BG_PANEL, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/colors';

interface ControlPanelProps {
  onStep?: () => void;
  onReset?: () => void;
}

export default function ControlPanel({ onStep, onReset }: ControlPanelProps) {
  const nodeCount = useDashboardStore((s) => s.nodeCount);
  const packetLoss = useDashboardStore((s) => s.packetLoss);
  const networkPreset = useDashboardStore((s) => s.networkPreset);
  const comparisonMode = useDashboardStore((s) => s.comparisonMode);
  const topology = useDashboardStore((s) => s.topology);
  const k = useDashboardStore((s) => s.k);
  const speed = useDashboardStore((s) => s.speed);
  const running = useDashboardStore((s) => s.running);
  const simulationDone = useDashboardStore((s) => s.simulationDone);
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);
  const simTime = useDashboardStore((s) => s.simTime);

  const setNodeCount = useDashboardStore((s) => s.setNodeCount);
  const setPacketLoss = useDashboardStore((s) => s.setPacketLoss);
  const setNetworkPreset = useDashboardStore((s) => s.setNetworkPreset);
  const setComparisonMode = useDashboardStore((s) => s.setComparisonMode);
  const setTopology = useDashboardStore((s) => s.setTopology);
  const setK = useDashboardStore((s) => s.setK);
  const setSpeed = useDashboardStore((s) => s.setSpeed);
  const regenerateTopology = useDashboardStore((s) => s.regenerateTopology);
  const resetSimulation = useDashboardStore((s) => s.resetSimulation);
  const setRunning = useDashboardStore((s) => s.setRunning);
  const startPropagation = useDashboardStore((s) => s.startPropagation);
  const nodes = useDashboardStore((s) => s.nodes);

  const handleReset = () => {
    onReset?.();
    clearEngine();
    resetSimulation();
  };

  const handleStartContinuous = () => {
    const randomIdx = Math.floor(Math.random() * nodes.length);
    startPropagation(nodes[randomIdx].id);
  };

  const canModifyNetwork = !running && !publisherNodeId;

  return (
    <div
      className="flex flex-col gap-5 p-5 overflow-y-auto h-full"
      style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY }}
    >
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold" style={{ color: ACCENT_TEAL }}>
          Controls
        </h2>
        <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>
          Configure the network simulation
        </p>
      </div>

      {/* Node Count */}
      <Section label="Flexnode Count" value={String(nodeCount)}>
        <input
          type="range"
          min={3}
          max={50}
          step={1}
          value={nodeCount}
          onChange={(e) => setNodeCount(Number(e.target.value))}
          className="w-full accent-teal-400"
          disabled={!canModifyNetwork}
        />
        <div className="flex justify-between text-[10px]" style={{ color: TEXT_SECONDARY }}>
          <span>3</span>
          <span>50</span>
        </div>
      </Section>

      {/* Topology */}
      <Section label="Topology">
        <div className="grid grid-cols-2 gap-1.5">
          {(['mesh', 'ring', 'star', 'random'] as TopologyType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTopology(t)}
              disabled={!canModifyNetwork}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: topology === t ? ACCENT_TEAL : '#1e2840',
                color: topology === t ? '#000' : TEXT_SECONDARY,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => { clearEngine(); regenerateTopology(); }}
          disabled={!canModifyNetwork}
          className="mt-2 w-full px-3 py-1.5 rounded text-xs font-medium transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: '#1e2840', color: TEXT_SECONDARY }}
        >
          Regenerate Layout
        </button>
      </Section>

      {/* Packet Loss */}
      <Section label="Network Messiness" value={`${packetLoss}%`}>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={packetLoss}
          onChange={(e) => setPacketLoss(Number(e.target.value))}
          className="w-full accent-teal-400"
          disabled={running}
        />
        <div className="flex justify-between text-[10px]" style={{ color: TEXT_SECONDARY }}>
          <span>0% (clean)</span>
          <span>50% (hostile)</span>
        </div>
      </Section>

      {/* Network Preset */}
      <Section label="Network">
        <div className="flex gap-1.5">
          {(['ethereum', 'solana', 'custom'] as NetworkPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setNetworkPreset(p)}
              disabled={!canModifyNetwork}
              className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: networkPreset === p ? ACCENT_TEAL : '#1e2840',
                color: networkPreset === p ? '#000' : TEXT_SECONDARY,
              }}
            >
              {NETWORK_PRESETS[p].label}
            </button>
          ))}
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: TEXT_SECONDARY }}>
          {networkPreset === 'ethereum' && 'Avg latency ~30ms · 12s slots'}
          {networkPreset === 'solana' && 'Avg latency ~15ms · 400ms slots'}
          {networkPreset === 'custom' && 'Avg latency ~25ms · 1s slots'}
        </p>
      </Section>

      {/* Comparison Mode */}
      <Section label="Mode">
        <div className="flex gap-1.5">
          {([
            { key: 'click', label: 'User Click' },
            { key: 'continuous', label: 'Continuous' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setComparisonMode(key)}
              disabled={!canModifyNetwork}
              className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: comparisonMode === key ? ACCENT_TEAL : '#1e2840',
                color: comparisonMode === key ? '#000' : TEXT_SECONDARY,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: TEXT_SECONDARY }}>
          {comparisonMode === 'click'
            ? 'Click a node to publish data from it'
            : 'Auto-publishes with random publisher, repeating'}
        </p>
      </Section>

      {/* Advanced Parameters */}
      <details className="group">
        <summary
          className="text-xs font-medium cursor-pointer select-none"
          style={{ color: TEXT_SECONDARY }}
        >
          Advanced Parameters
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <Section label="RLNC Shards (k)" value={String(k)}>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={k}
              onChange={(e) => setK(Number(e.target.value))}
              className="w-full accent-teal-400"
              disabled={!canModifyNetwork}
            />
          </Section>

          <Section label="Simulation Speed" value={`${speed}x`}>
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.25}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-teal-400"
            />
          </Section>
        </div>
      </details>

      {/* Keyboard shortcuts hint */}
      <div className="text-[9px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
        <span className="font-medium">Shortcuts:</span>{' '}
        <kbd className="px-1 py-0.5 rounded bg-[#1e2840] text-[8px]">Space</kbd> play/pause{' '}
        <kbd className="px-1 py-0.5 rounded bg-[#1e2840] text-[8px]">R</kbd> reset{' '}
        <kbd className="px-1 py-0.5 rounded bg-[#1e2840] text-[8px]">S</kbd> step
      </div>

      {/* Simulation Controls */}
      <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[#2a3450]">
        {/* Sim time display */}
        {publisherNodeId && (
          <div className="text-[10px] font-mono text-center mb-1" style={{ color: TEXT_SECONDARY }}>
            Sim: {simTime.toFixed(1)}ms
          </div>
        )}

        <div className="flex gap-2">
          {running ? (
            <button
              onClick={() => setRunning(false)}
              className="flex-1 px-4 py-2 rounded text-xs font-bold transition-colors"
              style={{ backgroundColor: '#FF174420', color: '#FF1744', border: '1px solid #FF174440' }}
            >
              Pause
            </button>
          ) : publisherNodeId && !simulationDone ? (
            <button
              onClick={() => setRunning(true)}
              className="flex-1 px-4 py-2 rounded text-xs font-bold transition-colors"
              style={{ backgroundColor: `${ACCENT_TEAL}20`, color: ACCENT_TEAL, border: `1px solid ${ACCENT_TEAL}40` }}
            >
              Resume
            </button>
          ) : comparisonMode === 'continuous' && !publisherNodeId ? (
            <button
              onClick={handleStartContinuous}
              className="flex-1 px-4 py-2 rounded text-xs font-bold transition-colors"
              style={{ backgroundColor: `${ACCENT_TEAL}20`, color: ACCENT_TEAL, border: `1px solid ${ACCENT_TEAL}40` }}
            >
              Start Continuous
            </button>
          ) : (
            <div className="flex-1 px-4 py-2 rounded text-xs font-bold text-center"
              style={{ backgroundColor: '#1e2840', color: TEXT_SECONDARY }}
            >
              {simulationDone
                ? (comparisonMode === 'continuous' ? 'Restarting...' : 'Done')
                : 'Click a node'}
            </div>
          )}

          {/* Step button */}
          {publisherNodeId && !running && !simulationDone && onStep && (
            <button
              onClick={onStep}
              className="px-4 py-2 rounded text-xs font-bold transition-colors"
              style={{ backgroundColor: '#1e2840', color: ACCENT_TEAL, border: `1px solid ${ACCENT_TEAL}40` }}
            >
              Step
            </button>
          )}
        </div>

        <button
          onClick={handleReset}
          className="w-full px-4 py-2 rounded text-xs font-bold transition-colors"
          style={{ backgroundColor: '#1e2840', color: TEXT_SECONDARY }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ── Helper ──

function Section({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium" style={{ color: TEXT_PRIMARY }}>
          {label}
        </label>
        {value && (
          <span
            className="text-xs font-mono"
            style={{ color: ACCENT_TEAL }}
          >
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
