"use client";

import { useRef, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { usePerformance } from "@/context/PerformanceGuard";

interface WaypointPin {
  id: string;
  name: string;
  date: string;
  position: THREE.Vector3;
  t: number; // position on curve (0 to 1)
  isUpcoming: boolean;
}

interface DashboardSceneProps {
  bookings: any[];
  upcomingTrip: any | null;
}

export function DashboardScene({ bookings = [], upcomingTrip }: DashboardSceneProps) {
  const { reducedMotion } = usePerformance();
  const { camera } = useThree();

  const [hoveredPin, setHoveredPin] = useState<WaypointPin | null>(null);

  // 1. Define the winding curve path (CatmullRomCurve3)
  const curve = useMemo(() => {
    const points = [
      new THREE.Vector3(-6, -2, -5),
      new THREE.Vector3(-3, 1, -2),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(3, 2, -1),
      new THREE.Vector3(6, 0, -3),
    ];
    return new THREE.CatmullRomCurve3(points);
  }, []);

  // 2. Map user bookings to curve parameters (t)
  const pins = useMemo(() => {
    const list: WaypointPin[] = [];
    
    // Sort bookings: past first, upcoming last
    const pastBookings = bookings.filter(b => b.status === "CONFIRMED" && b.booking_reference !== upcomingTrip?.booking_references?.[0]);
    
    // Place past bookings at early steps of the ribbon
    pastBookings.slice(0, 3).forEach((b, idx) => {
      const t = 0.2 + idx * 0.2; // 0.2, 0.4, 0.6
      const position = curve.getPointAt(t);
      list.push({
        id: b.booking_reference,
        name: b.title || "Past Trip",
        date: b.description || "",
        position,
        t,
        isUpcoming: false
      });
    });

    // Place upcoming booking near the end of the ribbon
    if (upcomingTrip) {
      const t = 0.8;
      const position = curve.getPointAt(t);
      list.push({
        id: upcomingTrip.id || "upcoming",
        name: upcomingTrip.name || "Upcoming Journey",
        date: upcomingTrip.start_date || "Soon",
        position,
        t,
        isUpcoming: true
      });
    }

    return list;
  }, [bookings, upcomingTrip, curve]);

  // 3. Custom shader for the winding tube (emissive teal-to-marigold flow)
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
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
          // Flow effect along length of tube
          float flow = sin(vUv.x * 8.0 - uTime * 2.5) * 0.5 + 0.5;
          vec3 baseColor = mix(uColorTeal, uColorMarigold, vUv.x);
          // Add a subtle emissive glow pulse
          vec3 finalColor = baseColor + (baseColor * flow * 0.25);
          gl_FragColor = vec4(finalColor, 0.85);
        }
      `
    };
  }, []);

  // 4. Animate the camera drift on load and idle floating
  const startTimer = useRef<number>(0);
  const initialCamPos = useMemo(() => new THREE.Vector3(0, 2, 8), []);
  const targetCamPos = useMemo(() => new THREE.Vector3(0, 0.5, 5.5), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = elapsed;
    }

    if (reducedMotion) {
      // Static camera view if reduced motion is preferred
      camera.position.copy(targetCamPos);
      camera.lookAt(0, 0, -2);
      return;
    }

    // Camera drift over first 2.5s
    if (startTimer.current < 2.5) {
      startTimer.current += delta;
      const alpha = Math.min(startTimer.current / 2.5, 1);
      // Smooth easing curve
      const t = alpha * (2 - alpha);
      camera.position.lerpVectors(initialCamPos, targetCamPos, t);
    } else {
      // Idle floating camera after drift
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

      {/* The winding ribbon tube */}
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

      {/* Glowing waypoint pins */}
      {pins.map((pin) => {
        const isHovered = hoveredPin?.id === pin.id;
        const scale = pin.isUpcoming 
          ? (isHovered ? 1.5 : 1.3)
          : (isHovered ? 1.2 : 1.0);

        return (
          <group key={pin.id} position={pin.position}>
            {/* The Pin Sphere */}
            <mesh
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
                color={pin.isUpcoming ? "#FF9F1C" : "#0FA3A0"}
                emissive={pin.isUpcoming ? "#FF9F1C" : "#0FA3A0"}
                emissiveIntensity={pin.isUpcoming ? 1.5 : 0.8}
                roughness={0.1}
                metalness={0.8}
              />
            </mesh>

            {/* Glowing outer ring for upcoming next trip */}
            {pin.isUpcoming && (
              <mesh scale={[1.6, 1.6, 1.6]}>
                <torusGeometry args={[0.18, 0.02, 8, 24]} />
                <meshBasicMaterial
                  color="#FF9F1C"
                  transparent
                  opacity={0.4 + Math.sin(Date.now() * 0.005) * 0.2}
                />
              </mesh>
            )}

            {/* Hover tooltip label using HTML */}
            {isHovered && (
              <Html distanceFactor={8} zIndexRange={[100, 0]} style={{ pointerEvents: "none" }}>
                <div className="bg-[#1E2140] border border-slate-700 px-3 py-1.5 rounded shadow-xl text-left min-w-[120px] backdrop-blur-md opacity-95">
                  <div className="text-[10px] font-display font-black text-marigold uppercase tracking-wider">
                    {pin.isUpcoming ? "Upcoming Trip" : "Visited Destination"}
                  </div>
                  <div className="text-[11px] font-body font-bold text-[#F5F3EE] truncate">
                    {pin.name}
                  </div>
                  {pin.date && (
                    <div className="text-[9px] font-data text-muted mt-0.5">
                      {pin.date}
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
