"use client";

import { useRef, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { usePerformance } from "@/context/PerformanceGuard";

export interface RibbonPin {
  id: string;
  name: string;
  subtitle?: string;
  position: THREE.Vector3;
  t: number;
  isSpecial?: boolean; // Equivalent to upcoming / glowing brighter
}

interface RouteRibbonProps {
  pins: RibbonPin[];
  curve: THREE.CatmullRomCurve3;
}

export function RouteRibbon({ pins, curve }: RouteRibbonProps) {
  const { reducedMotion } = usePerformance();
  const { camera } = useThree();
  const [hoveredPin, setHoveredPin] = useState<RibbonPin | null>(null);

  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // Custom shader for the winding tube (emissive teal-to-marigold flow)
  const shaderData = useMemo(() => {
    return {
      uniforms: {
        uTime: { value: 0 },
        uColorTeal: { value: new THREE.Color("#0FA3A0") },
        uColorMarigold: { value: new THREE.Color("#FF9F1C") },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorTeal;
        uniform vec3 uColorMarigold;
        varying vec2 vUv;
        void main() {
          float flow = sin(vUv.x * 8.0 - uTime * 2.5) * 0.5 + 0.5;
          vec3 baseColor = mix(uColorTeal, uColorMarigold, vUv.x);
          vec3 finalColor = baseColor + (baseColor * flow * 0.25);
          gl_FragColor = vec4(finalColor, 0.85);
        }
      `
    };
  }, []);

  // Camera animation parameters
  const startTimer = useRef<number>(0);
  const initialCamPos = useMemo(() => new THREE.Vector3(0, 2, 8), []);
  const targetCamPos = useMemo(() => new THREE.Vector3(0, 0.5, 5.5), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = elapsed;
    }

    if (reducedMotion) {
      camera.position.copy(targetCamPos);
      camera.lookAt(0, 0, -2);
      return;
    }

    if (startTimer.current < 2.5) {
      startTimer.current += delta;
      const alpha = Math.min(startTimer.current / 2.5, 1);
      const t = alpha * (2 - alpha);
      camera.position.lerpVectors(initialCamPos, targetCamPos, t);
    } else {
      const speed = 0.5;
      const amplitude = 0.15;
      camera.position.x = targetCamPos.x + Math.sin(elapsed * speed) * amplitude;
      camera.position.y = targetCamPos.y + Math.cos(elapsed * speed * 0.8) * (amplitude * 0.5);
    }
    camera.lookAt(0, 0, -2);
  });

  return (
    <>
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <pointLight position={[-5, 5, -5]} intensity={0.4} color="#0FA3A0" />
      <pointLight position={[5, -5, 5]} intensity={0.4} color="#FF9F1C" />

      {/* Ribbon Tube */}
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 80, 0.12, 12, false]} />
        <shaderMaterial
          ref={shaderRef}
          transparent
          depthWrite={true}
          vertexShader={shaderData.vertexShader}
          fragmentShader={shaderData.fragmentShader}
          uniforms={shaderData.uniforms}
        />
      </mesh>

      {/* Waypoint pins */}
      {pins.map((pin) => {
        const isHovered = hoveredPin?.id === pin.id;
        const scale = pin.isSpecial
          ? (isHovered ? 1.5 : 1.3)
          : (isHovered ? 1.2 : 1.0);

        return (
          <group key={pin.id} position={pin.position}>
            <mesh
              scale={[scale, scale, scale]}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
                setHoveredPin(pin);
              }}
              onPointerOut={() => {
                document.body.style.cursor = "default";
                setHoveredPin(null);
              }}
            >
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial
                color={pin.isSpecial ? "#FF9F1C" : "#0FA3A0"}
                emissive={pin.isSpecial ? "#FF9F1C" : "#0FA3A0"}
                emissiveIntensity={pin.isSpecial ? 1.5 : 0.8}
                roughness={0.1}
                metalness={0.8}
              />
            </mesh>

            {pin.isSpecial && (
              <mesh scale={[1.6, 1.6, 1.6]}>
                <torusGeometry args={[0.18, 0.02, 8, 24]} />
                <meshBasicMaterial
                  color="#FF9F1C"
                  transparent
                  opacity={0.4 + Math.sin(Date.now() * 0.005) * 0.2}
                />
              </mesh>
            )}

            {isHovered && (
              <Html distanceFactor={8} zIndexRange={[100, 0]} style={{ pointerEvents: "none" }}>
                <div className="bg-[#1E2140] border border-slate-700 px-3 py-1.5 rounded shadow-xl text-left min-w-[120px] backdrop-blur-md opacity-95">
                  <div className="text-[10px] font-display font-black text-marigold uppercase tracking-wider">
                    {pin.isSpecial ? "Special Waypoint" : "Destination"}
                  </div>
                  <div className="text-[11px] font-body font-bold text-[#F5F3EE] truncate">
                    {pin.name}
                  </div>
                  {pin.subtitle && (
                    <div className="text-[9px] font-data text-muted mt-0.5">
                      {pin.subtitle}
                    </div>
                  )}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
