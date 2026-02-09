'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useDashboardStore } from '@/store';
import { shardColor, GOSSIP_COLOR, ACCENT_TEAL, RECONSTRUCTED_GREEN, NODE_PUBLISHING } from '@/constants/colors';
import { isRLNCReconstructed, hasGossipMessage } from '@/simulation/engine';

const GLOBE_RADIUS = 2;

/**
 * Converts a 2D node position (from the flat layout) into lat/lon on a sphere.
 * The flat layout coordinates are normalized to cover most of the visible globe.
 */
function positionToSpherical(
  pos: { x: number; y: number },
  allPositions: { x: number; y: number }[],
): { lat: number; lon: number } {
  // Find bounds of all positions
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of allPositions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Normalize to [-60, 60] lat and [-150, 150] lon
  const lon = ((pos.x - minX) / rangeX - 0.5) * 300;
  const lat = ((pos.y - minY) / rangeY - 0.5) * -120; // flip Y

  return { lat, lon };
}

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// ── Globe mesh ──

function Globe() {
  return (
    <group>
      {/* Solid dark sphere */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial color="#0a1020" roughness={0.8} />
      </mesh>
      {/* Wireframe grid */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.005, 36, 18]} />
        <meshBasicMaterial color="#1e2840" wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ── Node points ──

function NodePoints() {
  const nodes = useDashboardStore((s) => s.nodes);
  const publisherNodeId = useDashboardStore((s) => s.publisherNodeId);
  useDashboardStore((s) => s.simTime); // trigger re-renders

  const positions = useMemo(() => nodes.map((n) => n.position), [nodes]);
  const spherical = useMemo(
    () => nodes.map((n) => positionToSpherical(n.position, positions)),
    [nodes, positions],
  );

  return (
    <group>
      {nodes.map((node, i) => {
        const { lat, lon } = spherical[i];
        const pos = latLonToVec3(lat, lon, GLOBE_RADIUS + 0.04);
        const isPublisher = node.id === publisherNodeId;
        const rlncDone = isRLNCReconstructed(node.id);
        const gossipDone = hasGossipMessage(node.id);

        let color = '#4A5568';
        if (isPublisher) color = NODE_PUBLISHING;
        else if (rlncDone) color = RECONSTRUCTED_GREEN;
        else if (gossipDone) color = GOSSIP_COLOR;

        return (
          <group key={node.id} position={pos}>
            <mesh>
              <sphereGeometry args={[isPublisher ? 0.06 : 0.04, 12, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isPublisher ? 0.8 : 0.4}
              />
            </mesh>
            {/* Glow */}
            <mesh>
              <sphereGeometry args={[isPublisher ? 0.12 : 0.08, 12, 12]} />
              <meshBasicMaterial color={color} transparent opacity={0.15} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Edge curves ──

function EdgeCurves() {
  const nodes = useDashboardStore((s) => s.nodes);
  const edges = useDashboardStore((s) => s.edges);

  const positions = useMemo(() => nodes.map((n) => n.position), [nodes]);
  const nodeMap = useMemo(() => {
    const map = new Map<string, { lat: number; lon: number }>();
    nodes.forEach((n) => {
      map.set(n.id, positionToSpherical(n.position, positions));
    });
    return map;
  }, [nodes, positions]);

  const curves = useMemo(() => {
    return edges.map((edge) => {
      const from = nodeMap.get(edge.source);
      const to = nodeMap.get(edge.target);
      if (!from || !to) return null;

      const v1 = latLonToVec3(from.lat, from.lon, GLOBE_RADIUS + 0.03);
      const v2 = latLonToVec3(to.lat, to.lon, GLOBE_RADIUS + 0.03);

      // Arc above the surface
      const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      const dist = v1.distanceTo(v2);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.03 + dist * 0.15);

      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      const points = curve.getPoints(24).map((p) => [p.x, p.y, p.z] as [number, number, number]);

      return { key: edge.id, points };
    }).filter(Boolean) as { key: string; points: [number, number, number][] }[];
  }, [edges, nodeMap]);

  return (
    <group>
      {curves.map(({ key, points }) => (
        <Line key={key} points={points} color="#1e2840" transparent opacity={0.4} lineWidth={1} />
      ))}
    </group>
  );
}

// ── Animated particles ──

function Particles() {
  const particles = useDashboardStore((s) => s.particles);
  const nodes = useDashboardStore((s) => s.nodes);

  const positions = useMemo(() => nodes.map((n) => n.position), [nodes]);
  const nodeMap = useMemo(() => {
    const map = new Map<string, { lat: number; lon: number }>();
    nodes.forEach((n) => {
      map.set(n.id, positionToSpherical(n.position, positions));
    });
    return map;
  }, [nodes, positions]);

  // Only show active (non-completed) particles, capped for performance
  const activeParticles = particles.filter((p) => p.progress < 1 && !p.dropped).slice(0, 200);

  return (
    <group>
      {activeParticles.map((particle) => {
        const from = nodeMap.get(particle.fromNode);
        const to = nodeMap.get(particle.toNode);
        if (!from || !to) return null;

        const v1 = latLonToVec3(from.lat, from.lon, GLOBE_RADIUS + 0.03);
        const v2 = latLonToVec3(to.lat, to.lon, GLOBE_RADIUS + 0.03);

        const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
        const dist = v1.distanceTo(v2);
        mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.03 + dist * 0.15);

        // Quadratic bezier interpolation
        const t = particle.progress;
        const pos = new THREE.Vector3();
        pos.x = (1 - t) * (1 - t) * v1.x + 2 * (1 - t) * t * mid.x + t * t * v2.x;
        pos.y = (1 - t) * (1 - t) * v1.y + 2 * (1 - t) * t * mid.y + t * t * v2.y;
        pos.z = (1 - t) * (1 - t) * v1.z + 2 * (1 - t) * t * mid.z + t * t * v2.z;

        const isRLNC = particle.protocol === 'rlnc';
        const color = isRLNC
          ? shardColor(particle.shardIndex ?? 0)
          : GOSSIP_COLOR;
        const size = isRLNC ? 0.02 : 0.03;

        return (
          <mesh key={particle.id} position={pos}>
            <sphereGeometry args={[size, 6, 6]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Main component ──

export default function GlobeView() {
  return (
    <div className="w-full h-full" style={{ background: '#050810' }}>
      <Canvas camera={{ position: [0, 1.5, 4], fov: 45 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />
        <pointLight position={[-3, 2, -3]} intensity={0.3} color="#00BFA5" />

        <Globe />
        <EdgeCurves />
        <NodePoints />
        <Particles />

        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={8}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 flex gap-4 text-[10px]" style={{ color: '#9AA0A6' }}>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_TEAL }} />
          mump2p (RLNC)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOSSIP_COLOR }} />
          GossipSub
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RECONSTRUCTED_GREEN }} />
          Reconstructed
        </span>
      </div>
    </div>
  );
}
