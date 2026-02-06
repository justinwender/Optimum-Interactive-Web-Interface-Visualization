'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge as FlowEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDashboardStore } from '@/store';
import FlexNodeComponent from './FlexNodeComponent';
import AnimatedEdge from './AnimatedEdge';
import ParticleOverlay from './ParticleOverlay';

const nodeTypes = {
  flexNode: FlexNodeComponent,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

interface NetworkCanvasProps {
  protocol: 'rlnc' | 'gossipsub';
}

export default function NetworkCanvas({ protocol }: NetworkCanvasProps) {
  const nodes = useDashboardStore((s) => s.nodes);
  const edges = useDashboardStore((s) => s.edges);

  // Convert simulation nodes to React Flow nodes, passing protocol in data
  const flowNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'flexNode',
        position: n.position,
        data: { label: n.label, nodeId: n.id, protocol },
        draggable: true,
      })),
    [nodes, protocol],
  );

  // Convert simulation edges to React Flow edges (deduplicated — one per pair)
  const flowEdges: FlowEdge[] = useMemo(() => {
    const seen = new Set<string>();
    const result: FlowEdge[] = [];
    for (const e of edges) {
      const key = [e.source, e.target].sort().join('--');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'animated',
      });
    }
    return result;
  }, [edges]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: 300 }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'animated' }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1a2235"
        />
        <ParticleOverlay protocol={protocol} />
      </ReactFlow>
    </div>
  );
}
