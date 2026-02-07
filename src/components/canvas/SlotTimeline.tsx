'use client';

import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/store';
import { NETWORK_PRESETS } from '@/constants/defaults';
import {
  ACCENT_TEAL,
  GOSSIP_COLOR,
  RECONSTRUCTED_GREEN,
  BG_PANEL,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/colors';

const FAIL_RED = '#FF1744';

/**
 * Horizontal timeline strip showing slot results in continuous mode.
 * Each slot shows the proposer, and whether RLNC/GossipSub succeeded
 * within the attestation deadline.
 */
export default function SlotTimeline() {
  const slotResults = useDashboardStore((s) => s.slotResults);
  const networkPreset = useDashboardStore((s) => s.networkPreset);
  const comparisonMode = useDashboardStore((s) => s.comparisonMode);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the right when new slots appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [slotResults.length]);

  // Only show in continuous mode (or when there are results to show)
  if (comparisonMode !== 'continuous' && slotResults.length === 0) return null;

  const preset = NETWORK_PRESETS[networkPreset];

  // Aggregate stats
  const totalSlots = slotResults.length;
  const rlncSuccesses = slotResults.filter((s) => s.rlncSuccess).length;
  const gossipSuccesses = slotResults.filter((s) => s.gossipSuccess).length;
  const savedByRlnc = slotResults.filter(
    (s) => s.rlncSuccess && !s.gossipSuccess,
  ).length;
  const bothFailed = slotResults.filter(
    (s) => !s.rlncSuccess && !s.gossipSuccess,
  ).length;

  const rewardLabel = preset?.blockRewardLabel || '';
  const rewardUsd = preset?.blockRewardUsd ?? 50;

  return (
    <div
      className="border-b border-[#1e2840] flex-shrink-0"
      style={{ backgroundColor: `${BG_PANEL}E6` }}
    >
      {/* Slot cards row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="text-[10px] font-semibold whitespace-nowrap mr-1"
          style={{ color: TEXT_SECONDARY }}
        >
          Slots
        </span>
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto flex-1 scrollbar-thin"
          style={{ scrollBehavior: 'smooth' }}
        >
          {slotResults.length === 0 ? (
            <span className="text-[10px] italic" style={{ color: TEXT_SECONDARY }}>
              Starting continuous mode...
            </span>
          ) : (
            slotResults.map((slot) => (
              <SlotCard key={slot.slotNumber} slot={slot} />
            ))
          )}
        </div>
      </div>

      {/* Aggregate stats row */}
      {totalSlots > 0 && (
        <div
          className="flex items-center gap-4 px-3 py-1.5 border-t border-[#1e2840] text-[10px]"
          style={{ color: TEXT_SECONDARY }}
        >
          <span>{totalSlots} slot{totalSlots !== 1 ? 's' : ''}</span>
          <span style={{ color: ACCENT_TEAL }}>
            mump2p: {rlncSuccesses}/{totalSlots} ({totalSlots > 0 ? Math.round((rlncSuccesses / totalSlots) * 100) : 0}%)
          </span>
          <span style={{ color: GOSSIP_COLOR }}>
            Gossip: {gossipSuccesses}/{totalSlots} ({totalSlots > 0 ? Math.round((gossipSuccesses / totalSlots) * 100) : 0}%)
          </span>
          {savedByRlnc > 0 && (
            <span className="font-semibold" style={{ color: RECONSTRUCTED_GREEN }}>
              mump2p saved {savedByRlnc} slot{savedByRlnc !== 1 ? 's' : ''}
              {rewardLabel && ` (${rewardLabel} each)`}
            </span>
          )}
          {savedByRlnc > 0 && rewardUsd > 0 && (
            <span className="font-semibold" style={{ color: RECONSTRUCTED_GREEN }}>
              +${(savedByRlnc * rewardUsd).toLocaleString()} est. rewards
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slot card ──

function SlotCard({ slot }: { slot: import('@/simulation/types').SlotResult }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-2 py-1 rounded flex-shrink-0"
      style={{
        backgroundColor: '#1e2840',
        minWidth: 52,
      }}
    >
      <span className="text-[9px] font-mono" style={{ color: TEXT_SECONDARY }}>
        #{slot.slotNumber}
      </span>
      <span className="text-[10px] font-semibold" style={{ color: TEXT_PRIMARY }}>
        {slot.proposerLabel}
      </span>
      <div className="flex gap-1.5 mt-0.5">
        {/* RLNC indicator */}
        <div className="flex flex-col items-center">
          <div
            className="w-3 h-3 rounded-sm"
            style={{
              backgroundColor: slot.rlncSuccess ? RECONSTRUCTED_GREEN : FAIL_RED,
            }}
            title={
              slot.rlncSuccess
                ? `RLNC: ${slot.rlncDeliveryMs?.toFixed(0)}ms`
                : 'RLNC: missed deadline'
            }
          />
          <span className="text-[7px]" style={{ color: ACCENT_TEAL }}>R</span>
        </div>
        {/* GossipSub indicator */}
        <div className="flex flex-col items-center">
          <div
            className="w-3 h-3 rounded-sm"
            style={{
              backgroundColor: slot.gossipSuccess ? GOSSIP_COLOR : FAIL_RED,
            }}
            title={
              slot.gossipSuccess
                ? `Gossip: ${slot.gossipDeliveryMs?.toFixed(0)}ms`
                : 'Gossip: missed deadline'
            }
          />
          <span className="text-[7px]" style={{ color: GOSSIP_COLOR }}>G</span>
        </div>
      </div>
    </div>
  );
}
