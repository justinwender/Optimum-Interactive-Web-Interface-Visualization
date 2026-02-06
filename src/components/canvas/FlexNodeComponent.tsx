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
} from '@/constants/colors';

export interface FlexNodeData {
  label: string;
  nodeId: string;
  [key: string]: unknown;
}

function FlexNodeComponent({ data }: NodeProps) {
  const { label, nodeId } = data as unknown as FlexNodeData;
  const nid = nodeId as string;
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);
  const k = useDashboardStore((s) => s.k);
  const running = useDashboardStore((s) => s.running);
  const comparisonMode = useDashboardStore((s) => s.comparisonMode);
  const startPropagation = useDashboardStore((s) => s.startPropagation);
  const simulationDone = useDashboardStore((s) => s.simulationDone);

  // Read engine state directly (re-renders driven by simTime changes)
  const simTime = useDashboardStore((s) => s.simTime);
  const isPublisher = publisherNodeId === nid;
  const hasStarted = publisherNodeId !== null;

  // Only query engine state if simulation has been started
  const rlncRank = hasStarted && !isPublisher ? getRLNCRank(nid) : (isPublisher ? k : 0);
  const rlncDone = hasStarted && !isPublisher ? isRLNCReconstructed(nid) : isPublisher;
  const gossipDone = hasStarted && !isPublisher ? hasGossipMessage(nid) : isPublisher;
  const rlncProgress = k > 0 ? rlncRank / k : 0;

  // Determine border color
  let borderColor = NODE_IDLE;
  if (isPublisher) {
    borderColor = NODE_PUBLISHING;
  } else if (rlncDone) {
    borderColor = RECONSTRUCTED_GREEN;
  } else if (gossipDone) {
    borderColor = GOSSIP_COLOR;
  }

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
      {/* Outer ring — RLNC progress */}
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
          stroke={NODE_IDLE}
          strokeWidth={3}
          opacity={0.3}
        />
        {rlncProgress > 0 && !isPublisher && (
          <circle
            cx={32}
            cy={32}
            r={28}
            fill="none"
            stroke={rlncDone ? RECONSTRUCTED_GREEN : ACCENT_TEAL}
            strokeWidth={3}
            strokeDasharray={`${rlncProgress * 175.9} ${175.9}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        )}
      </svg>

      {/* Inner circle */}
      <div
        className="rounded-full flex items-center justify-center z-10 transition-all duration-300"
        style={{
          width: 44,
          height: 44,
          backgroundColor: isPublisher ? '#1a1a2e' : '#0f1220',
          border: `2px solid ${borderColor}`,
          boxShadow: isPublisher
            ? `0 0 16px ${NODE_PUBLISHING}60`
            : rlncDone
              ? `0 0 12px ${RECONSTRUCTED_GREEN}40`
              : 'none',
        }}
      >
        <span
          className="text-xs font-bold select-none"
          style={{ color: borderColor }}
        >
          {label as string}
        </span>
      </div>

      {/* Status indicator */}
      {!isPublisher && hasStarted && (rlncDone || gossipDone) && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold z-20"
          style={{
            backgroundColor: rlncDone ? RECONSTRUCTED_GREEN : GOSSIP_COLOR,
            color: '#000',
          }}
        >
          {rlncDone ? '\u2713' : '\u2022'}
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
