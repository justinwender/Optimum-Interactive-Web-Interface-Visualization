'use client';

import { useDashboardStore } from '@/store';
import {
  BG_PANEL,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  ACCENT_TEAL,
  RECONSTRUCTED_GREEN,
  GOSSIP_COLOR,
} from '@/constants/colors';

export default function MetricsPanel() {
  const rlncDeliveryTime = useDashboardStore((s) => s.rlncDeliveryTime);
  const gossipDeliveryTime = useDashboardStore((s) => s.gossipDeliveryTime);
  const rlncMetrics = useDashboardStore((s) => s.rlncMetrics);
  const gossipMetrics = useDashboardStore((s) => s.gossipMetrics);
  const running = useDashboardStore((s) => s.running);
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);
  const rlncStates = useDashboardStore((s) => s.rlncStates);
  const gossipStates = useDashboardStore((s) => s.gossipStates);
  const subscriberNodeIds = useDashboardStore((s) => s.subscriberNodeIds);
  const k = useDashboardStore((s) => s.k);

  const rlncReconstructedCount = subscriberNodeIds.filter(
    (id) => rlncStates.get(id)?.reconstructed,
  ).length;
  const gossipDeliveredCount = subscriberNodeIds.filter(
    (id) => gossipStates.get(id)?.hasMessage,
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

  const rlncOverhead =
    rlncMetrics.usefulTransmissions > 0
      ? (rlncMetrics.totalTransmissions / rlncMetrics.usefulTransmissions).toFixed(2)
      : '-';
  const gossipOverhead =
    gossipMetrics.usefulTransmissions > 0
      ? (gossipMetrics.totalTransmissions / gossipMetrics.usefulTransmissions).toFixed(2)
      : '-';

  const isIdle = !publisherNodeId;

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
              ? 'Simulation running...'
              : 'Simulation complete'}
        </p>
      </div>

      {/* Latency */}
      <MetricSection title="Latency">
        <DualBar
          label="Delivery Time"
          rlncValue={rlncDeliveryTime}
          gossipValue={gossipDeliveryTime}
          unit="ms"
          maxValue={Math.max(rlncDeliveryTime ?? 100, gossipDeliveryTime ?? 100, 100)}
        />
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
      <MetricSection title="Bandwidth">
        <div className="space-y-2">
          <MetricRow
            label="Total Transmissions"
            rlnc={String(rlncMetrics.totalTransmissions)}
            gossip={String(gossipMetrics.totalTransmissions)}
          />
          <MetricRow
            label="Useful"
            rlnc={String(rlncMetrics.usefulTransmissions)}
            gossip={String(gossipMetrics.usefulTransmissions)}
          />
          <MetricRow
            label="Overhead Ratio"
            rlnc={`${rlncOverhead}x`}
            gossip={`${gossipOverhead}x`}
          />
        </div>
      </MetricSection>

      {/* Node Progress */}
      {!isIdle && (
        <MetricSection title="Node Status">
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {subscriberNodeIds.map((id) => {
              const rlnc = rlncStates.get(id);
              const gossip = gossipStates.get(id);
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
                        width: `${((rlnc?.rank ?? 0) / k) * 100}%`,
                        backgroundColor: rlnc?.reconstructed
                          ? RECONSTRUCTED_GREEN
                          : ACCENT_TEAL,
                      }}
                    />
                  </div>
                  {/* GossipSub indicator */}
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: gossip?.hasMessage
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
              RLNC
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOSSIP_COLOR }} />
              GossipSub
            </span>
          </div>
        </MetricSection>
      )}

      {/* Comparison Table */}
      {!isIdle && !running && (
        <MetricSection title="Summary">
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
                <tr className="border-b border-[#2a3450]">
                  <td className="p-2" style={{ color: TEXT_SECONDARY }}>Delivery</td>
                  <td className="text-right p-2 font-mono">{rlncDeliveryTime ?? '-'}ms</td>
                  <td className="text-right p-2 font-mono">{gossipDeliveryTime ?? '-'}ms</td>
                </tr>
                <tr className="border-b border-[#2a3450]">
                  <td className="p-2" style={{ color: TEXT_SECONDARY }}>Success</td>
                  <td className="text-right p-2 font-mono">{rlncSuccessRate}%</td>
                  <td className="text-right p-2 font-mono">{gossipSuccessRate}%</td>
                </tr>
                <tr>
                  <td className="p-2" style={{ color: TEXT_SECONDARY }}>Overhead</td>
                  <td className="text-right p-2 font-mono">{rlncOverhead}x</td>
                  <td className="text-right p-2 font-mono">{gossipOverhead}x</td>
                </tr>
              </tbody>
            </table>
          </div>
        </MetricSection>
      )}
    </div>
  );
}

// ── Sub-components ──

function MetricSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold mb-2" style={{ color: TEXT_PRIMARY }}>
        {title}
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
      {/* mump2p bar */}
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
        <span className="text-[10px] font-mono w-12 text-right">
          {rlncValue != null ? `${rlncValue}${unit}` : '...'}
        </span>
      </div>
      {/* GossipSub bar */}
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
        <span className="text-[10px] font-mono w-12 text-right">
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
