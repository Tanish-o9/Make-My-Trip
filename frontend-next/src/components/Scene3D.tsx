"use client";

/**
 * Scene3D wrapper component — Phase 0
 *
 * This component is used by individual pages to register their 3D scenes.
 * It registers the scene on mount and clears it on unmount.
 *
 * If `use3D = false` (low-end device or no WebGL), it renders the provided `fallback` component
 * instead of mounting the 3D geometry in the Canvas.
 */

import { ReactElement, useEffect } from "react";
import { useScene } from "@/context/SceneContext";
import { usePerformance } from "@/context/PerformanceGuard";

interface Scene3DProps {
  id: string;
  sceneContent: ReactElement;
  fallback: ReactElement;
}

export function Scene3D({ id, sceneContent, fallback }: Scene3DProps) {
  const { registerScene, clearScene, canvasError } = useScene();
  const { use3D, ready } = usePerformance();

  useEffect(() => {
    if (use3D && ready && !canvasError) {
      registerScene(id, sceneContent);
      return () => {
        clearScene(id);
      };
    }
  }, [id, sceneContent, registerScene, clearScene, use3D, ready, canvasError]);

  // Render 2D fallback directly if 3D is disabled or if R3F canvas crashed
  if (ready && (!use3D || canvasError)) {
    return <>{fallback}</>;
  }

  return null;
}
