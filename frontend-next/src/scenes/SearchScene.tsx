"use client";

/**
 * SearchScene — Phase 3
 *
 * Subtle rotating low-poly wireframe globe representing India/Earth coordinates
 * with glowing result markers. Reacts to changes in results count.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePerformance } from "@/context/PerformanceGuard";

interface SearchSceneProps {
  resultsCount: number;
}

export function SearchScene({ resultsCount }: SearchSceneProps) {
  const { reducedMotion } = usePerformance();
  const groupRef = useRef<THREE.Group>(null);

  // Generate spherical coordinates for result dots based on resultsCount
  const dots = useMemo(() => {
    const list = [];
    const count = Math.min(resultsCount, 15); // cap at 15 dots for performance
    
    // Constant seed distribution on the sphere surface
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      
      const radius = 2.22; // slightly outside the 2.2 radius globe
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      list.push(new THREE.Vector3(x, y, z));
    }
    return list;
  }, [resultsCount]);

  // Slowly rotate the globe on its axis
  useFrame((state) => {
    if (groupRef.current && !reducedMotion) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.12;
      groupRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.05) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Subtle Ambient / Point light context */}
      <pointLight position={[5, 5, 5]} intensity={0.4} color="#0FA3A0" />
      <pointLight position={[-5, -5, -5]} intensity={0.2} color="#FF9F1C" />

      {/* Low-Poly Wireframe Globe */}
      <mesh>
        <sphereGeometry args={[2.2, 16, 16]} />
        <meshBasicMaterial
          color="#0FA3A0"
          wireframe
          transparent
          opacity={0.12} // very subtle, secondary background element
          depthWrite={false}
        />
      </mesh>

      {/* stylized core shell */}
      <mesh>
        <sphereGeometry args={[2.18, 16, 16]} />
        <meshBasicMaterial
          color="#14162B"
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>

      {/* Reactive glowing result dots */}
      {dots.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial
            color={idx % 2 === 0 ? "#FF9F1C" : "#0FA3A0"}
            transparent
            opacity={0.8 + Math.sin(Date.now() * 0.005 + idx) * 0.2}
          />
        </mesh>
      ))}
    </group>
  );
}
