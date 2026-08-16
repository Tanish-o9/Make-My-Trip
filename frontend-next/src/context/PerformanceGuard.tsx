"use client";

/**
 * PerformanceGuard — Phase 0
 *
 * Detects:
 *   1. WebGL availability
 *   2. Low-end device (hardwareConcurrency < 4)
 *   3. prefers-reduced-motion
 *
 * Sets use3D = false on low-end/no-WebGL devices.
 * Sets reducedMotion = true when the OS motion preference is set.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface PerformanceCtx {
  use3D: boolean;
  reducedMotion: boolean;
  ready: boolean;
}

const PerformanceContext = createContext<PerformanceCtx>({
  use3D: true,
  reducedMotion: false,
  ready: false,
});

export function usePerformance() {
  return useContext(PerformanceContext);
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

function detectReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function detectLowEnd(): boolean {
  const cores =
    (navigator as Navigator & { hardwareConcurrency?: number })
      .hardwareConcurrency ?? 4;
  // < 4 logical CPU cores → treat as low-end
  return cores < 4;
}

export function PerformanceGuard({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<PerformanceCtx>({
    use3D: true,
    reducedMotion: false,
    ready: false,
  });

  useEffect(() => {
    const hasWebGL = detectWebGL();
    const isLowEnd = detectLowEnd();
    const prefersReducedMotion = detectReducedMotion();

    setCtx({
      use3D: hasWebGL && !isLowEnd,
      reducedMotion: prefersReducedMotion,
      ready: true,
    });

    // Live-listen for motion preference changes
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) =>
      setCtx((prev) => ({ ...prev, reducedMotion: e.matches }));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <PerformanceContext.Provider value={ctx}>
      {children}
    </PerformanceContext.Provider>
  );
}
