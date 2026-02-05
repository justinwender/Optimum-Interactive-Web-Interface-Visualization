'use client';

import { useDashboardStore } from '@/store';
import { shardColor, GOSSIP_COLOR } from '@/constants/colors';
import { useReactFlow } from '@xyflow/react';

/**
 * Renders animated particles on top of the React Flow canvas.
 * Each particle travels from source node to target node along a straight line.
 */
export default function ParticleOverlay() {
  const particles = useDashboardStore((s) => s.particles);
  const nodes = useDashboardStore((s) => s.nodes);
  const { getNode } = useReactFlow();

  if (particles.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    >
      {particles.map((particle) => {
        const sourceFlowNode = getNode(particle.fromNode);
        const targetFlowNode = getNode(particle.toNode);
        if (!sourceFlowNode || !targetFlowNode) return null;

        const sx = (sourceFlowNode.position?.x ?? 0) + 32; // center of 64px node
        const sy = (sourceFlowNode.position?.y ?? 0) + 32;
        const tx = (targetFlowNode.position?.x ?? 0) + 32;
        const ty = (targetFlowNode.position?.y ?? 0) + 32;

        const x = sx + (tx - sx) * particle.progress;
        const y = sy + (ty - sy) * particle.progress;

        const color =
          particle.protocol === 'rlnc'
            ? shardColor(particle.shardIndex ?? 0)
            : GOSSIP_COLOR;

        const radius = particle.protocol === 'rlnc' ? 4 : 6;

        return (
          <circle
            key={particle.id}
            cx={x}
            cy={y}
            r={radius}
            fill={color}
            opacity={particle.dropped ? 0.2 : 0.9}
          >
            {/* Glow effect */}
            <animate
              attributeName="r"
              values={`${radius};${radius + 1.5};${radius}`}
              dur="0.6s"
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </svg>
  );
}
