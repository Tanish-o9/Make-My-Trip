"use client";

/**
 * PersistentCanvas — Phase 0
 *
 * Mounted ONCE in the root layout. Never remounts between route changes.
 * Renders whatever scene content is currently registered in SceneContext
 * with a smooth opacity crossfade (400ms) during transitions.
 *
 * console.log("R3F context created") fires ONCE total — used for verification.
 */

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { useScene } from "@/context/SceneContext";
import { usePerformance } from "@/context/PerformanceGuard";
import { ErrorBoundary3D } from "./ErrorBoundary3D";

export function PersistentCanvas() {
  const { use3D } = usePerformance();
  const { activeScene, transitioning, canvasError, setCanvasError } = useScene();

  // Don't mount Canvas at all when 3D is off or has crashed
  if (!use3D || canvasError) return null;

  return (
    <div
      id="r3f-canvas"
      style={{
        opacity: transitioning ? 0 : 1,
        transition: "opacity 400ms ease",
      }}
    >
      <Canvas
        camera={{ position: [0, 2, 8], fov: 55 }}
        dpr={[1, 1.5]}           // cap pixel ratio for performance
        gl={{ antialias: true, alpha: true }}
        onCreated={() => {
          // Should fire EXACTLY ONCE across all route changes
          console.log("[R3F] WebGL context created");
        }}
      >
        <ambientLight intensity={0.4} />
        <Suspense fallback={null}>
          <ErrorBoundary3D
            pageName={activeScene?.id || "unknown"}
            setCanvasError={setCanvasError}
          >
            {activeScene?.content ?? null}
          </ErrorBoundary3D>
        </Suspense>
      </Canvas>
    </div>
  );
}
