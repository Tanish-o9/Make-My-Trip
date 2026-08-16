"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePerformance } from "@/context/PerformanceGuard";

interface BookingRibbonSceneProps {
  currentStep: number; // 0, 1, 2, or 3
}

export function BookingRibbonScene({ currentStep }: BookingRibbonSceneProps) {
  const { reducedMotion } = usePerformance();
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // Define a clean curved path in front of the camera
  const curve = useMemo(() => {
    const points = [
      new THREE.Vector3(-3, -0.5, 0),
      new THREE.Vector3(-1.5, 0.5, -0.5),
      new THREE.Vector3(0, -0.5, 0),
      new THREE.Vector3(1.5, 0.5, -0.5),
      new THREE.Vector3(3, -0.5, 0),
    ];
    return new THREE.CatmullRomCurve3(points);
  }, []);

  // Map steps to uProgress value (Step 1 = 0.25, Step 2 = 0.5, Step 3 = 0.75, Step 4 = 1.0)
  const targetProgress = useMemo(() => {
    return (currentStep + 1) * 0.25;
  }, [currentStep]);

  // Current progressive interpolation ref
  const currentProgress = useRef(0.25);

  const shaderData = useMemo(() => {
    return {
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0.25 },
        uColorTeal: { value: new THREE.Color("#0FA3A0") },
        uColorMarigold: { value: new THREE.Color("#FF9F1C") },
        uColorDormant: { value: new THREE.Color("#1E2140") },
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
        uniform float uProgress;
        uniform vec3 uColorTeal;
        uniform vec3 uColorMarigold;
        uniform vec3 uColorDormant;
        varying vec2 vUv;
        void main() {
          // If the length along the tube is beyond the current step progress, render dormant
          if (vUv.x > uProgress) {
            gl_FragColor = vec4(uColorDormant, 0.4);
            return;
          }

          // Otherwise render the glowing shader
          float flow = sin(vUv.x * 8.0 - uTime * 3.0) * 0.5 + 0.5;
          vec3 baseColor = mix(uColorTeal, uColorMarigold, vUv.x / uProgress);
          vec3 finalColor = baseColor + (baseColor * flow * 0.3);
          gl_FragColor = vec4(finalColor, 0.9);
        }
      `
    };
  }, []);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = elapsed;

      // Animate progress change smoothly
      if (reducedMotion) {
        currentProgress.current = targetProgress;
      } else {
        const speed = 2.0; // speed of progress bar fill
        if (currentProgress.current < targetProgress) {
          currentProgress.current = Math.min(currentProgress.current + delta * speed, targetProgress);
        } else if (currentProgress.current > targetProgress) {
          currentProgress.current = Math.max(currentProgress.current - delta * speed, targetProgress);
        }
      }
      shaderRef.current.uniforms.uProgress.value = currentProgress.current;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 5, 5]} intensity={0.5} />

      {/* The booking flow step tube */}
      <mesh>
        <tubeGeometry args={[curve, 60, 0.1, 8, false]} />
        <shaderMaterial
          ref={shaderRef}
          transparent
          vertexShader={shaderData.vertexShader}
          fragmentShader={shaderData.fragmentShader}
          uniforms={shaderData.uniforms}
        />
      </mesh>
    </>
  );
}
