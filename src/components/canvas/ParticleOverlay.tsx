'use client';

import { useDashboardStore } from '@/store';
import { shardColor, GOSSIP_COLOR } from '@/constants/colors';
import { useReactFlow } from '@xyflow/react';

interface ParticleOverlayProps {
  protocol: 'rlnc' | 'gossipsub';
}

/**
 * Renders animated particles on top of the React Flow canvas.
 *
 * RLNC shards: small diamond shapes (data fragments), rainbow-colored.
 * GossipSub messages: larger rounded blocks (whole messages), orange.
 * Redundant particles (arriving at already-complete nodes) shown dimmer/gray.
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

        const isRLNC = particle.protocol === 'rlnc';
        const isRedundant = particle.isRedundant ?? false;

        if (isRLNC) {
          // ── RLNC shard: small diamond shape ──
          const color = isRedundant ? '#667788' : shardColor(particle.shardIndex ?? 0);
          const baseR = isRedundant ? 3 : 4;
          const r = baseR * Math.max(zoom, 0.5);
          const glowR = r * 2.5;
          const mainOpacity = particle.dropped ? 0.12 : isRedundant ? 0.3 : 0.85;
          const glowOpacity = particle.dropped ? 0 : isRedundant ? 0.04 : 0.12;

          // Diamond: four points at top/right/bottom/left
          const diamond = `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;

          return (
            <g key={particle.id}>
              {glowOpacity > 0 && (
                <circle cx={x} cy={y} r={glowR} fill={color} opacity={glowOpacity} />
              )}
              <polygon points={diamond} fill={color} opacity={mainOpacity} />
            </g>
          );
        } else {
          // ── GossipSub message: larger rounded block ──
          const color = isRedundant ? '#997744' : GOSSIP_COLOR;
          const baseR = isRedundant ? 5 : 7;
          const r = baseR * Math.max(zoom, 0.5);
          const glowR = r * 2.5;
          const mainOpacity = particle.dropped ? 0.12 : isRedundant ? 0.3 : 0.85;
          const glowOpacity = particle.dropped ? 0 : isRedundant ? 0.04 : 0.1;

          return (
            <g key={particle.id}>
              {glowOpacity > 0 && (
                <circle cx={x} cy={y} r={glowR} fill={color} opacity={glowOpacity} />
              )}
              <rect
                x={x - r}
                y={y - r * 0.7}
                width={r * 2}
                height={r * 1.4}
                rx={r * 0.25}
                fill={color}
                opacity={mainOpacity}
              />
            </g>
          );
        }
      })}
    </svg>
  );
}
