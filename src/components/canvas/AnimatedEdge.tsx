'use client';

import { memo } from 'react';
import {
  BaseEdge,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#4A556840',
        strokeWidth: 1.5,
        ...style,
      }}
    />
  );
}

export default memo(AnimatedEdge);
