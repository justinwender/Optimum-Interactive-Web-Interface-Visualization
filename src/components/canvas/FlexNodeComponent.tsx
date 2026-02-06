'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useDashboardStore } from '@/store';
import {
  getRLNCRank,
  isRLNCReconstructed,
  hasGossipMessage,
} from '@/simulation/engine';
import {
  NODE_IDLE,
  NODE_PUBLISHING,
  RECONSTRUCTED_GREEN,
  GOSSIP_COLOR,
  ACCENT_TEAL,
  shardColor,
} from '@/constants/colors';

export interface FlexNodeData {
  label: string;
  nodeId: string;
  protocol: 'rlnc' | 'gossipsub';
  [key: string]: unknown;
}

function FlexNodeComponent({ data }: NodeProps) {
  const { label, nodeId, protocol } = data as unknown as FlexNodeData;
  const nid = nodeId as string;
  const isRLNC = protocol === 'rlnc';

  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);
  const k = useDashboardStore((s) => s.k);
  const running = useDashboardStore((s) => s.running);
  const comparisonMode = useDashboardStore((s) => s.comparisonMode);
  const startPropagation = useDashboardStore((s) => s.startPropagation);
  const simulationDone = useDashboardStore((s) => s.simulationDone);

  // Read engine state directly (re-renders driven by simTime changes)
  useDashboardStore((s) => s.simTime);
  const isPublisher = publisherNodeId === nid;
  const hasStarted = publisherNodeId !== null;

  // Query engine state
  const rlncRank = hasStarted && !isPublisher ? getRLNCRank(nid) : (isPublisher ? k : 0);
  const rlncDone = hasStarted && !isPublisher ? isRLNCReconstructed(nid) : isPublisher;
  const gossipDone = hasStarted && !isPublisher ? hasGossipMessage(nid) : isPublisher;

  // Protocol-specific border color
  let borderColor = NODE_IDLE;
  if (isPublisher) {
    borderColor = NODE_PUBLISHING;
  } else if (isRLNC) {
    if (rlncDone) borderColor = RECONSTRUCTED_GREEN;
    else if (rlncRank > 0) borderColor = ACCENT_TEAL;
  } else {
    if (gossipDone) borderColor = GOSSIP_COLOR;
  }

  // Propagating glow (animated outer aura) — nodes actively sending data
  // RLNC relays propagate from first shard onward (even after reconstruction)
  // GossipSub relays propagate after receiving the full message
  let glowClass = '';
  if (hasStarted && !simulationDone) {
    if (isPublisher) {
      glowClass = 'publisher-glow';
    } else if (isRLNC && rlncRank > 0) {
      glowClass = 'rlnc-relay-glow';
    } else if (!isRLNC && gossipDone) {
      glowClass = 'gossip-relay-glow';
    }
  }

  // Receiving fill — inner glow that fills up as data arrives
  let receivingProgress = 0;
  let receivingColor = isRLNC ? ACCENT_TEAL : GOSSIP_COLOR;
  if (!isPublisher && hasStarted) {
    if (isRLNC) {
      receivingProgress = Math.min(rlncRank / k, 1);
      if (rlncDone) receivingColor = RECONSTRUCTED_GREEN;
    } else {
      receivingProgress = gossipDone ? 1 : 0;
    }
  }

  // RLNC progress ring calculations
  const circumference = 2 * Math.PI * 28; // ~175.93
  const segLength = circumference / k;
  const gap = 2;
  const displayRank = Math.min(rlncRank, k);

  const handleClick = () => {
    if (comparisonMode === 'click' && !running && !simulationDone) {
      startPropagation(nid);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative flex items-center justify-center cursor-pointer group"
      style={{ width: 64, height: 64 }}
    >
      {/* Outer ring — RLNC rainbow progress (only in RLNC canvas) */}
      {isRLNC && (
        <svg
          width={64}
          height={64}
          className="absolute top-0 left-0"
          viewBox="0 0 64 64"
        >
          {/* Background ring */}
          <circle
            cx={32}
            cy={32}
            r={28}
            fill="none"
            stroke={NODE_IDLE}
            strokeWidth={3}
            opacity={0.3}
          />
          {/* Rainbow progress segments */}
          {!isPublisher && displayRank > 0 &&
            Array.from({ length: displayRank }, (_, i) => {
              const arcLength = segLength - gap;
              const offset = -(i * segLength + gap / 2);
              return (
                <circle
                  key={i}
                  cx={32}
                  cy={32}
                  r={28}
                  fill="none"
                  stroke={rlncDone ? RECONSTRUCTED_GREEN : shardColor(i)}
                  strokeWidth={3}
                  strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 32 32)"
                  style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.3s ease' }}
                />
              );
            })
          }
          {/* Publisher: full ring */}
          {isPublisher && hasStarted && (
            <circle
              cx={32}
              cy={32}
              r={28}
              fill="none"
              stroke={ACCENT_TEAL}
              strokeWidth={3}
              opacity={0.6}
            />
          )}
        </svg>
      )}

      {/* GossipSub: simple outer ring (received or not) */}
      {!isRLNC && (
        <svg
          width={64}
          height={64}
          className="absolute top-0 left-0"
          viewBox="0 0 64 64"
        >
          <circle
            cx={32}
            cy={32}
            r={28}
            fill="none"
            stroke={gossipDone && !isPublisher ? GOSSIP_COLOR : NODE_IDLE}
            strokeWidth={3}
            opacity={gossipDone && !isPublisher ? 0.6 : 0.3}
            style={{ transition: 'stroke 0.3s ease, opacity 0.3s ease' }}
          />
          {isPublisher && hasStarted && (
            <circle
              cx={32}
              cy={32}
              r={28}
              fill="none"
              stroke={GOSSIP_COLOR}
              strokeWidth={3}
              opacity={0.6}
            />
          )}
        </svg>
      )}

      {/* Inner circle with propagating glow + receiving fill */}
      <div
        className={`rounded-full flex items-center justify-center z-10 ${glowClass}`}
        style={{
          width: 44,
          height: 44,
          backgroundColor: isPublisher ? '#1a1a2e' : '#0f1220',
          border: `2px solid ${borderColor}`,
          position: 'relative',
          transition: 'border-color 0.3s ease',
        }}
      >
        {/* Receiving fill overlay — fills up as data arrives */}
        {!isPublisher && hasStarted && receivingProgress > 0 && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              backgroundColor: receivingColor,
              opacity: receivingProgress * 0.35,
              transition: 'opacity 0.3s ease, background-color 0.3s ease',
            }}
          />
        )}
        <span
          className="text-xs font-bold select-none relative"
          style={{ color: borderColor, zIndex: 1 }}
        >
          {label as string}
        </span>
      </div>

      {/* Status indicator — protocol-specific */}
      {isRLNC && rlncDone && !isPublisher && hasStarted && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold z-20"
          style={{
            backgroundColor: RECONSTRUCTED_GREEN,
            color: '#000',
          }}
        >
          {'\u2713'}
        </div>
      )}
      {!isRLNC && gossipDone && !isPublisher && hasStarted && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold z-20"
          style={{
            backgroundColor: GOSSIP_COLOR,
            color: '#000',
          }}
        >
          {'\u2713'}
        </div>
      )}

      {/* Hover tooltip */}
      {!running && !simulationDone && comparisonMode === 'click' && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none">
          Click to publish from {label as string}
        </div>
      )}

      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

export default memo(FlexNodeComponent);
