'use client';

import { useDashboardStore } from '@/store';
import { shardColor, GOSSIP_COLOR } from '@/constants/colors';
import { useReactFlow } from '@xyflow/react';

interface ParticleOverlayProps {
  protocol: 'rlnc' | 'gossipsub';
}

/**
 * Renders animated particles on top of the React Flow canvas.
 * Applies the viewport transform so particles align with nodes
 * regardless of zoom/pan state.
 */
export default function ParticleOverlay({ protocol }: ParticleOverlayProps) {
  const particles = useDashboardStore((s) => s.particles);
  const { getNode, getViewport } = useReactFlow();

  const filtered = particles.filter((p) => p.protocol === protocol);
  if (filtered.length === 0) return null;

  // Get current viewport transform to convert flow → screen coords
  const { x: vx, y: vy, zoom } = getViewport();

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', zIndex: 20 }}
    >
      {filtered.map((particle) => {
        const sourceFlowNode = getNode(particle.fromNode);
        const targetFlowNode = getNode(particle.toNode);
        if (!sourceFlowNode || !targetFlowNode) return null;

        // Node centers in flow coordinates (nodes are 64x64)
        const flowSx = (sourceFlowNode.position?.x ?? 0) + 32;
        const flowSy = (sourceFlowNode.position?.y ?? 0) + 32;
        const flowTx = (targetFlowNode.position?.x ?? 0) + 32;
        const flowTy = (targetFlowNode.position?.y ?? 0) + 32;

        // Interpolate position in flow coords
        const flowX = flowSx + (flowTx - flowSx) * particle.progress;
        const flowY = flowSy + (flowTy - flowSy) * particle.progress;

        // Transform to screen coords (relative to React Flow container)
        const x = flowX * zoom + vx;
        const y = flowY * zoom + vy;

        const color =
          particle.protocol === 'rlnc'
            ? shardColor(particle.shardIndex ?? 0)
            : GOSSIP_COLOR;

        const baseRadius = particle.protocol === 'rlnc' ? 4 : 5;
        const radius = baseRadius * Math.max(zoom, 0.5);
        const glowRadius = radius * 3;

        return (
          <g key={particle.id}>
            {/* Glow trail — larger, semi-transparent circle behind the particle */}
            {!particle.dropped && (
              <circle
                cx={x}
                cy={y}
                r={glowRadius}
                fill={color}
                opacity={0.12}
              />
            )}
            {/* Main particle */}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={color}
              opacity={particle.dropped ? 0.15 : 0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}
