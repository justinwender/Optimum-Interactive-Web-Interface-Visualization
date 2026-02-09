'use client';

import { useDashboardStore } from '@/store';
import { ACCENT_TEAL, GOSSIP_COLOR, RECONSTRUCTED_GREEN, TEXT_SECONDARY } from '@/constants/colors';

interface RaceTimerProps {
  protocol: 'rlnc' | 'gossipsub';
}

/**
 * Overlay timer on each canvas showing the race between protocols.
 * Shows a running stopwatch while the protocol is in progress,
 * then freezes at the final delivery time (green) when complete.
 */
export default function RaceTimer({ protocol }: RaceTimerProps) {
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);
  const simTime = useDashboardStore((s) => s.simTime);
  const engineMetrics = useDashboardStore((s) => s.engineMetrics);
  const subscriberNodeIds = useDashboardStore((s) => s.subscriberNodeIds);

  if (!publisherNodeId) return null;

  const isRLNC = protocol === 'rlnc';
  const metrics = isRLNC ? engineMetrics?.rlnc : engineMetrics?.gossipsub;
  const deliveryTime = metrics?.lastDeliverySimMs;
  const allDone = metrics?.allDone ?? false;
  const deliveredCount = metrics?.deliveredNodes?.length ?? 0;
  const totalSubscribers = subscriberNodeIds.length;
  const accentColor = isRLNC ? ACCENT_TEAL : GOSSIP_COLOR;

  return (
    <div
      className="absolute top-3 right-3 px-3 py-2 rounded-lg z-20 min-w-[80px] text-right"
      style={{
        backgroundColor: allDone ? `${RECONSTRUCTED_GREEN}15` : '#0A0E17CC',
        border: `1px solid ${allDone ? RECONSTRUCTED_GREEN + '40' : '#2a345060'}`,
        backdropFilter: 'blur(4px)',
      }}
    >
      {allDone ? (
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs" style={{ color: RECONSTRUCTED_GREEN }}>
            {'\u2713'}
          </span>
          <span
            className="text-base font-mono font-bold tabular-nums"
            style={{ color: RECONSTRUCTED_GREEN }}
          >
            {deliveryTime}ms
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-0.5">
          <span
            className="text-base font-mono font-bold tabular-nums"
            style={{ color: accentColor }}
          >
            {simTime.toFixed(1)}ms
          </span>
          {deliveredCount > 0 && (
            <span className="text-[9px]" style={{ color: TEXT_SECONDARY }}>
              {deliveredCount}/{totalSubscribers} delivered
            </span>
          )}
        </div>
      )}
    </div>
  );
}
