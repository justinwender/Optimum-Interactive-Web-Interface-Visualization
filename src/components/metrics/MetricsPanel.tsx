'use client';

import { useDashboardStore } from '@/store';
import {
  getRLNCRank,
  isRLNCReconstructed,
  hasGossipMessage,
} from '@/simulation/engine';
import {
  BG_PANEL,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  ACCENT_TEAL,
  RECONSTRUCTED_GREEN,
  GOSSIP_COLOR,
} from '@/constants/colors';
import { NETWORK_PRESETS } from '@/constants/defaults';

export default function MetricsPanel() {
  const engineMetrics = useDashboardStore((s) => s.engineMetrics);
  const running = useDashboardStore((s) => s.running);
  const simulationDone = useDashboardStore((s) => s.simulationDone);
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);
  const subscriberNodeIds = useDashboardStore((s) => s.subscriberNodeIds);
  const k = useDashboardStore((s) => s.k);
  const simTime = useDashboardStore((s) => s.simTime);
  const slotResults = useDashboardStore((s) => s.slotResults);
  const networkPreset = useDashboardStore((s) => s.networkPreset);
  const comparisonMode = useDashboardStore((s) => s.comparisonMode);

  const isIdle = !publisherNodeId;

  // Compute success rates from engine state
  const rlncReconstructedCount = subscriberNodeIds.filter((id) =>
    isRLNCReconstructed(id),
  ).length;
  const gossipDeliveredCount = subscriberNodeIds.filter((id) =>
    hasGossipMessage(id),
  ).length;
  const totalSubscribers = subscriberNodeIds.length;

  const rlncSuccessRate =
    totalSubscribers > 0
      ? Math.round((rlncReconstructedCount / totalSubscribers) * 100)
      : 0;
  const gossipSuccessRate =
    totalSubscribers > 0
      ? Math.round((gossipDeliveredCount / totalSubscribers) * 100)
      : 0;

  const rlncDeliveryTime = engineMetrics?.rlnc.lastDeliverySimMs ?? null;
  const gossipDeliveryTime = engineMetrics?.gossipsub.lastDeliverySimMs ?? null;

  const rlncTotal = engineMetrics?.rlnc.totalTransmissions ?? 0;
  const rlncUseful = engineMetrics?.rlnc.usefulTransmissions ?? 0;
  const gossipTotal = engineMetrics?.gossipsub.totalTransmissions ?? 0;
  const gossipUseful = engineMetrics?.gossipsub.usefulTransmissions ?? 0;
  const gossipDuplicates = engineMetrics?.gossipsub.duplicates ?? 0;

  const rlncOverhead =
    rlncUseful > 0 ? (rlncTotal / rlncUseful).toFixed(2) : '-';
  const gossipOverhead =
    gossipUseful > 0 ? (gossipTotal / gossipUseful).toFixed(2) : '-';

  return (
    <div
      className="flex flex-col gap-5 p-5 overflow-y-auto h-full"
      style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY }}
    >
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold" style={{ color: ACCENT_TEAL }}>
          Metrics
        </h2>
        <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>
          {isIdle
            ? 'Click a node to start propagation'
            : running
              ? `Sim time: ${simTime.toFixed(1)}ms`
              : simulationDone
                ? 'Simulation complete'
                : 'Paused'}
        </p>
      </div>

      {/* Latency */}
      <MetricSection title="Latency (simulated)" tooltip="Simulated time for the block to propagate from proposer to all validators. Lower is better.">
        <DualBar
          label="Full delivery time"
          rlncValue={rlncDeliveryTime}
          gossipValue={gossipDeliveryTime}
          unit="ms"
          maxValue={Math.max(rlncDeliveryTime ?? 100, gossipDeliveryTime ?? 100, 100)}
        />
        {rlncDeliveryTime !== null && gossipDeliveryTime !== null && gossipDeliveryTime > 0 && (() => {
          const pctFaster = ((1 - rlncDeliveryTime / gossipDeliveryTime) * 100);
          if (pctFaster > 0) {
            return (
              <p className="text-[10px] mt-2 font-medium" style={{ color: ACCENT_TEAL }}>
                mump2p is {pctFaster.toFixed(0)}% faster
              </p>
            );
          } else if (pctFaster < 0) {
            return (
              <p className="text-[10px] mt-2 font-medium" style={{ color: GOSSIP_COLOR }}>
                GossipSub is {Math.abs(pctFaster).toFixed(0)}% faster
              </p>
            );
          }
          return (
            <p className="text-[10px] mt-2 font-medium" style={{ color: TEXT_SECONDARY }}>
              Same delivery time
            </p>
          );
        })()}
      </MetricSection>

      {/* Success Rate */}
      <MetricSection title="Delivery Success">
        <div className="flex gap-4">
          <DonutMini
            label="mump2p"
            value={rlncSuccessRate}
            color={RECONSTRUCTED_GREEN}
            detail={`${rlncReconstructedCount}/${totalSubscribers}`}
          />
          <DonutMini
            label="GossipSub"
            value={gossipSuccessRate}
            color={GOSSIP_COLOR}
            detail={`${gossipDeliveredCount}/${totalSubscribers}`}
          />
        </div>
      </MetricSection>

      {/* Bandwidth */}
      <MetricSection title="Bandwidth" tooltip="Overhead ratio = total transmissions / useful transmissions. RLNC's algebraic redundancy is more efficient than GossipSub's duplicate-heavy approach.">
        <div className="space-y-2">
          <MetricRow
            label="Total Transmissions"
            rlnc={String(rlncTotal)}
            gossip={String(gossipTotal)}
          />
          <MetricRow
            label="Useful"
            rlnc={String(rlncUseful)}
            gossip={String(gossipUseful)}
          />
          <MetricRow
            label="Overhead Ratio"
            rlnc={`${rlncOverhead}x`}
            gossip={`${gossipOverhead}x`}
          />
          <MetricRow
            label="Duplicates"
            rlnc="-"
            gossip={String(gossipDuplicates)}
          />
        </div>
      </MetricSection>

      {/* Node Progress */}
      {!isIdle && (
        <MetricSection title="Node Status">
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {subscriberNodeIds.map((id) => {
              const rank = getRLNCRank(id);
              const reconstructed = isRLNCReconstructed(id);
              const hasMsg = hasGossipMessage(id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 text-[10px]"
                >
                  <span className="w-12 font-mono" style={{ color: TEXT_SECONDARY }}>
                    {id.replace('node-', 'N')}
                  </span>
                  {/* RLNC progress bar */}
                  <div className="flex-1 h-2 rounded-full bg-[#1e2840] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(rank / k) * 100}%`,
                        backgroundColor: reconstructed
                          ? RECONSTRUCTED_GREEN
                          : ACCENT_TEAL,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono w-6 text-right" style={{ color: TEXT_SECONDARY }}>
                    {rank}/{k}
                  </span>
                  {/* GossipSub indicator */}
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: hasMsg
                        ? GOSSIP_COLOR
                        : '#1e2840',
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: TEXT_SECONDARY }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RECONSTRUCTED_GREEN }} />
              RLNC rank
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOSSIP_COLOR }} />
              GossipSub
            </span>
          </div>
        </MetricSection>
      )}

      {/* Live Comparison Table */}
      {!isIdle && simulationDone && (
        <LiveComparisonTable
          rlncDeliveryTime={rlncDeliveryTime}
          gossipDeliveryTime={gossipDeliveryTime}
          rlncSuccessRate={rlncSuccessRate}
          gossipSuccessRate={gossipSuccessRate}
          rlncOverhead={rlncOverhead}
          gossipOverhead={gossipOverhead}
          slotResults={slotResults}
          networkPreset={networkPreset}
        />
      )}

      {/* Continuous Mode Aggregate Metrics */}
      {comparisonMode === 'continuous' && slotResults.length > 0 && (
        <ContinuousAggregateSection
          slotResults={slotResults}
          networkPreset={networkPreset}
        />
      )}
    </div>
  );
}

// ── Sub-components ──

function MetricSection({
  title,
  tooltip,
  children,
}: {
  title: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: TEXT_PRIMARY }}>
        {title}
        {tooltip && (
          <span
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold cursor-help"
            style={{ backgroundColor: '#1e2840', color: TEXT_SECONDARY }}
            title={tooltip}
          >
            ?
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

function DualBar({
  label,
  rlncValue,
  gossipValue,
  unit,
  maxValue,
}: {
  label: string;
  rlncValue: number | null;
  gossipValue: number | null;
  unit: string;
  maxValue: number;
}) {
  const rlncWidth = rlncValue != null ? Math.max(4, (rlncValue / maxValue) * 100) : 0;
  const gossipWidth = gossipValue != null ? Math.max(4, (gossipValue / maxValue) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]" style={{ color: TEXT_SECONDARY }}>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] w-14" style={{ color: RECONSTRUCTED_GREEN }}>mump2p</span>
        <div className="flex-1 h-3 rounded bg-[#1e2840] overflow-hidden">
          <div
            className="h-full rounded transition-all duration-500"
            style={{
              width: `${rlncWidth}%`,
              backgroundColor: RECONSTRUCTED_GREEN,
            }}
          />
        </div>
        <span className="text-[10px] font-mono w-16 text-right">
          {rlncValue != null ? `${rlncValue}${unit}` : '...'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] w-14" style={{ color: GOSSIP_COLOR }}>Gossip</span>
        <div className="flex-1 h-3 rounded bg-[#1e2840] overflow-hidden">
          <div
            className="h-full rounded transition-all duration-500"
            style={{
              width: `${gossipWidth}%`,
              backgroundColor: GOSSIP_COLOR,
            }}
          />
        </div>
        <span className="text-[10px] font-mono w-16 text-right">
          {gossipValue != null ? `${gossipValue}${unit}` : '...'}
        </span>
      </div>
    </div>
  );
}

function DonutMini({
  label,
  value,
  color,
  detail,
}: {
  label: string;
  value: number;
  color: string;
  detail: string;
}) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <svg width={48} height={48} viewBox="0 0 48 48">
        <circle cx={24} cy={24} r={18} fill="none" stroke="#1e2840" strokeWidth={4} />
        <circle
          cx={24}
          cy={24}
          r={18}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text
          x={24}
          y={24}
          textAnchor="middle"
          dominantBaseline="central"
          fill={TEXT_PRIMARY}
          fontSize={11}
          fontWeight={600}
          fontFamily="monospace"
        >
          {value}%
        </text>
      </svg>
      <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
      <span className="text-[9px]" style={{ color: TEXT_SECONDARY }}>{detail}</span>
    </div>
  );
}

function MetricRow({
  label,
  rlnc,
  gossip,
}: {
  label: string;
  rlnc: string;
  gossip: string;
}) {
  return (
    <div className="flex items-center text-[10px]">
      <span className="flex-1" style={{ color: TEXT_SECONDARY }}>{label}</span>
      <span className="w-14 text-right font-mono" style={{ color: RECONSTRUCTED_GREEN }}>{rlnc}</span>
      <span className="w-14 text-right font-mono" style={{ color: GOSSIP_COLOR }}>{gossip}</span>
    </div>
  );
}

// ── Percentile helper ──

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Live Comparison Table ──

function LiveComparisonTable({
  rlncDeliveryTime,
  gossipDeliveryTime,
  rlncSuccessRate,
  gossipSuccessRate,
  rlncOverhead,
  gossipOverhead,
  slotResults,
  networkPreset,
}: {
  rlncDeliveryTime: number | null;
  gossipDeliveryTime: number | null;
  rlncSuccessRate: number;
  gossipSuccessRate: number;
  rlncOverhead: string;
  gossipOverhead: string;
  slotResults: import('@/simulation/types').SlotResult[];
  networkPreset: string;
}) {
  const preset = NETWORK_PRESETS[networkPreset];

  // Collect delivery times from slot results for percentiles
  const rlncTimes = slotResults
    .filter((s) => s.rlncDeliveryMs != null)
    .map((s) => s.rlncDeliveryMs!)
    .sort((a, b) => a - b);
  const gossipTimes = slotResults
    .filter((s) => s.gossipDeliveryMs != null)
    .map((s) => s.gossipDeliveryMs!)
    .sort((a, b) => a - b);

  const hasEnoughForP50 = rlncTimes.length >= 5 || gossipTimes.length >= 5;
  const hasEnoughForP95 = rlncTimes.length >= 20 || gossipTimes.length >= 20;

  // Bandwidth saved: compare overhead ratios
  const rlncOH = parseFloat(rlncOverhead);
  const gossipOH = parseFloat(gossipOverhead);
  const bandwidthSaved =
    !isNaN(rlncOH) && !isNaN(gossipOH) && gossipOH > 0
      ? ((1 - rlncOH / gossipOH) * 100).toFixed(0)
      : null;

  // Continuous mode stats
  const totalSlots = slotResults.length;
  const savedByRlnc = slotResults.filter((s) => s.rlncSuccess && !s.gossipSuccess).length;
  const rewardUsd = preset?.blockRewardUsd ?? 0;

  // Row helper
  const Row = ({ label, rlnc, gossip, highlight }: { label: string; rlnc: string; gossip: string; highlight?: boolean }) => (
    <tr className={highlight ? 'border-b border-[#2a3450] bg-[#1a2540]' : 'border-b border-[#2a3450]'}>
      <td className="p-2" style={{ color: TEXT_SECONDARY }}>{label}</td>
      <td className="text-right p-2 font-mono">{rlnc}</td>
      <td className="text-right p-2 font-mono">{gossip}</td>
    </tr>
  );

  return (
    <MetricSection title="Comparison">
      <div className="rounded border border-[#2a3450] overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-[#2a3450]">
              <th className="text-left p-2 font-medium" style={{ color: TEXT_SECONDARY }}>Metric</th>
              <th className="text-right p-2 font-medium" style={{ color: RECONSTRUCTED_GREEN }}>mump2p</th>
              <th className="text-right p-2 font-medium" style={{ color: GOSSIP_COLOR }}>GossipSub</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="Delivery"
              rlnc={rlncDeliveryTime != null ? `${rlncDeliveryTime}ms` : 'N/A'}
              gossip={gossipDeliveryTime != null ? `${gossipDeliveryTime}ms` : 'N/A'}
            />
            {hasEnoughForP50 && (
              <Row
                label="P50 Latency"
                rlnc={rlncTimes.length >= 5 ? `${percentile(rlncTimes, 50).toFixed(1)}ms` : '-'}
                gossip={gossipTimes.length >= 5 ? `${percentile(gossipTimes, 50).toFixed(1)}ms` : '-'}
              />
            )}
            {hasEnoughForP95 && (
              <Row
                label="P95 Latency"
                rlnc={rlncTimes.length >= 20 ? `${percentile(rlncTimes, 95).toFixed(1)}ms` : '-'}
                gossip={gossipTimes.length >= 20 ? `${percentile(gossipTimes, 95).toFixed(1)}ms` : '-'}
              />
            )}
            <Row
              label="Success"
              rlnc={`${rlncSuccessRate}%`}
              gossip={`${gossipSuccessRate}%`}
            />
            <Row
              label="Overhead"
              rlnc={`${rlncOverhead}x`}
              gossip={`${gossipOverhead}x`}
            />
            {bandwidthSaved !== null && Number(bandwidthSaved) > 0 && (
              <Row
                label="BW Saved"
                rlnc={`${bandwidthSaved}%`}
                gossip="-"
                highlight
              />
            )}
            {totalSlots > 0 && (
              <>
                <Row
                  label="Slots (on-time)"
                  rlnc={`${slotResults.filter((s) => s.rlncSuccess).length}/${totalSlots}`}
                  gossip={`${slotResults.filter((s) => s.gossipSuccess).length}/${totalSlots}`}
                />
                {savedByRlnc > 0 && (
                  <Row
                    label="Saved by mump2p"
                    rlnc={`${savedByRlnc} slot${savedByRlnc !== 1 ? 's' : ''}`}
                    gossip="-"
                    highlight
                  />
                )}
                {savedByRlnc > 0 && rewardUsd > 0 && (
                  <Row
                    label="Est. Extra Rewards"
                    rlnc={`+$${(savedByRlnc * rewardUsd).toLocaleString()}`}
                    gossip="-"
                    highlight
                  />
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </MetricSection>
  );
}

function ContinuousAggregateSection({
  slotResults,
  networkPreset,
}: {
  slotResults: import('@/simulation/types').SlotResult[];
  networkPreset: string;
}) {
  const preset = NETWORK_PRESETS[networkPreset];
  const total = slotResults.length;
  const rlncSuccesses = slotResults.filter((s) => s.rlncSuccess).length;
  const gossipSuccesses = slotResults.filter((s) => s.gossipSuccess).length;
  const savedByRlnc = slotResults.filter(
    (s) => s.rlncSuccess && !s.gossipSuccess,
  ).length;

  const rlncRate = total > 0 ? Math.round((rlncSuccesses / total) * 100) : 0;
  const gossipRate = total > 0 ? Math.round((gossipSuccesses / total) * 100) : 0;

  // Average delivery times (only for successful slots)
  const rlncTimes = slotResults
    .filter((s) => s.rlncSuccess && s.rlncDeliveryMs != null)
    .map((s) => s.rlncDeliveryMs!);
  const gossipTimes = slotResults
    .filter((s) => s.gossipSuccess && s.gossipDeliveryMs != null)
    .map((s) => s.gossipDeliveryMs!);

  const avgRlnc = rlncTimes.length > 0
    ? (rlncTimes.reduce((a, b) => a + b, 0) / rlncTimes.length).toFixed(1)
    : '-';
  const avgGossip = gossipTimes.length > 0
    ? (gossipTimes.reduce((a, b) => a + b, 0) / gossipTimes.length).toFixed(1)
    : '-';

  const rewardLabel = preset?.blockRewardLabel || '';
  const rewardUsd = preset?.blockRewardUsd ?? 50;

  return (
    <MetricSection title="Continuous Mode Aggregate">
      <div className="space-y-2">
        <MetricRow
          label="Total Slots"
          rlnc=""
          gossip=""
        />
        <div className="text-[10px] font-mono text-center" style={{ color: TEXT_PRIMARY }}>
          {total} slot{total !== 1 ? 's' : ''} completed
        </div>
        <MetricRow
          label="Success Rate"
          rlnc={`${rlncRate}%`}
          gossip={`${gossipRate}%`}
        />
        <MetricRow
          label="Avg Delivery"
          rlnc={avgRlnc !== '-' ? `${avgRlnc}ms` : '-'}
          gossip={avgGossip !== '-' ? `${avgGossip}ms` : '-'}
        />
        <MetricRow
          label="On-time Slots"
          rlnc={`${rlncSuccesses}/${total}`}
          gossip={`${gossipSuccesses}/${total}`}
        />
      </div>

      {/* Saved by mump2p highlight */}
      {savedByRlnc > 0 && (
        <div
          className="mt-3 p-2.5 rounded border"
          style={{
            backgroundColor: `${RECONSTRUCTED_GREEN}10`,
            borderColor: `${RECONSTRUCTED_GREEN}30`,
          }}
        >
          <p className="text-[11px] font-semibold" style={{ color: RECONSTRUCTED_GREEN }}>
            mump2p saved {savedByRlnc} proposal{savedByRlnc !== 1 ? 's' : ''}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: TEXT_SECONDARY }}>
            {savedByRlnc} slot{savedByRlnc !== 1 ? 's' : ''} where mump2p delivered on time
            but GossipSub missed the attestation deadline
          </p>
          {rewardLabel && (
            <p className="text-[10px] mt-1 font-mono" style={{ color: RECONSTRUCTED_GREEN }}>
              Est. extra rewards: {savedByRlnc} x {rewardLabel} = +${(savedByRlnc * rewardUsd).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {savedByRlnc === 0 && total > 2 && (
        <p className="text-[10px] mt-2 italic" style={{ color: TEXT_SECONDARY }}>
          Try increasing packet loss to see mump2p&apos;s advantage under adversarial conditions
        </p>
      )}
    </MetricSection>
  );
}
