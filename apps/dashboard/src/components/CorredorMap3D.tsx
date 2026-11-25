'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';

type NodeKey = 'manaus' | 'belem' | 'portoVelho' | 'saoPaulo' | 'panama';

const NODES: Record<NodeKey, { label: string; position: [number, number, number]; tone: 'hub' | 'port' | 'warning' }> = {
  manaus: { label: 'Manaus', position: [-0.8, 0.22, -2.4], tone: 'hub' },
  belem: { label: 'Belém', position: [2.1, 0.18, -2.0], tone: 'port' },
  portoVelho: { label: 'Porto Velho', position: [-1.6, 0.18, 0.1], tone: 'port' },
  saoPaulo: { label: 'São Paulo', position: [0.9, 0.18, 3.2], tone: 'port' },
  panama: { label: 'Panamá', position: [-4.2, 0.18, -2.9], tone: 'warning' },
};

function curveBetween(start: NodeKey, end: NodeKey, lift = 1.1) {
  const a = new THREE.Vector3(...NODES[start].position);
  const b = new THREE.Vector3(...NODES[end].position);
  const mid = a.clone().lerp(b, 0.5);
  mid.y += lift;
  mid.x += (b.z - a.z) * 0.08;
  return { start: a.toArray() as [number, number, number], end: b.toArray() as [number, number, number], mid: mid.toArray() as [number, number, number] };
}

function PulsingHub() {
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const pulse = (elapsed % 2.2) / 2.2;
    if (ring.current) {
      ring.current.scale.setScalar(1 + pulse * 1.8);
      const material = ring.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.42 * (1 - pulse);
    }
    if (core.current) {
      core.current.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.08);
    }
  });

  return (
    <group position={NODES.manaus.position}>
      <mesh ref={core}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial color="#F97316" emissive="#EA580C" emissiveIntensity={1.8} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <ringGeometry args={[0.22, 0.26, 48]} />
        <meshBasicMaterial color="#F97316" transparent opacity={0.42} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PortNode({ nodeKey }: { nodeKey: NodeKey }) {
  const node = NODES[nodeKey];
  const color = node.tone === 'warning' ? '#F97316' : '#38BDF8';
  return (
    <group position={node.position}>
      {node.tone !== 'hub' && (
        <mesh>
          <sphereGeometry args={[0.105, 24, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
        </mesh>
      )}
      <Html center distanceFactor={9} position={[0, 0.34, 0]}>
        <div className="rounded-full border border-cyan-300/20 bg-slate-950/80 px-2 py-1 text-[10px] font-semibold whitespace-nowrap text-slate-100 shadow-lg">
          {node.label}
        </div>
      </Html>
    </group>
  );
}

function Terrain() {
  const geometry = useMemo(() => new THREE.PlaneGeometry(9.5, 8.2, 34, 30), []);
  const positions = useMemo(() => {
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      position.setZ(index, Math.sin(x * 1.5) * 0.06 + Math.cos(y * 1.8) * 0.05);
    }
    position.needsUpdate = true;
    return geometry;
  }, [geometry]);

  return (
    <group rotation={[-Math.PI / 2, 0, -0.12]} position={[0, -0.18, 0.25]}>
      <mesh geometry={positions}>
        <meshStandardMaterial color="#091322" roughness={0.92} metalness={0.08} />
      </mesh>
      <mesh geometry={positions}>
        <meshBasicMaterial color="#16324d" wireframe transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

function Routes() {
  const br319 = useMemo(() => curveBetween('manaus', 'portoVelho', 0.9), []);
  const br319South = useMemo(() => curveBetween('portoVelho', 'saoPaulo', 1.25), []);
  const river = useMemo(() => curveBetween('manaus', 'belem', 0.82), []);
  const belemSouth = useMemo(() => curveBetween('belem', 'saoPaulo', 1.45), []);
  const panama = useMemo(() => curveBetween('panama', 'saoPaulo', 1.7), []);

  return (
    <group>
      <QuadraticBezierLine {...river} color="#38BDF8" lineWidth={3.2} transparent opacity={0.95} />
      <QuadraticBezierLine {...belemSouth} color="#0284C7" lineWidth={2.3} transparent opacity={0.78} />
      <QuadraticBezierLine {...br319} color="#38BDF8" lineWidth={3} transparent opacity={0.95} />
      <QuadraticBezierLine {...br319South} color="#0284C7" lineWidth={2.3} transparent opacity={0.78} />
      <QuadraticBezierLine {...panama} color="#F97316" lineWidth={2.2} dashed dashScale={7} transparent opacity={0.74} />
    </group>
  );
}

export default function CorredorMap3D() {
  return (
    <div className="h-[340px] w-full overflow-hidden rounded-2xl bg-[#08111e] scan-grid" aria-label="Mapa 3D dos corredores logísticos">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0.2, 6.4, 8.6], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 7, 4]} intensity={1.4} />
        <pointLight position={[-2, 3, -2]} color="#F97316" intensity={2.4} distance={5} />
        <Terrain />
        <Routes />
        <PulsingHub />
        {(Object.keys(NODES) as NodeKey[]).filter((key) => key !== 'manaus').map((key) => <PortNode key={key} nodeKey={key} />)}
        <PortNode nodeKey="manaus" />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.32} minPolarAngle={0.72} maxPolarAngle={1.15} />
      </Canvas>
    </div>
  );
}
