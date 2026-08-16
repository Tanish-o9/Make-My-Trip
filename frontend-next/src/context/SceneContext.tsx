"use client";

/**
 * SceneContext — Phase 0
 *
 * Each page registers its own R3F scene content here.
 * The root layout's persistent <Canvas> renders whatever is
 * currently registered — swapping with a 400ms crossfade on route change.
 *
 * Usage (in any page):
 *   const { registerScene } = useScene();
 *   useEffect(() => {
 *     registerScene("homepage", <HomepageScene />);
 *     return () => clearScene("homepage");
 *   }, []);
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  ReactElement,
} from "react";

interface SceneEntry {
  id: string;
  content: ReactElement;
}

interface SceneCtx {
  activeScene: SceneEntry | null;
  transitioning: boolean;
  registerScene: (id: string, content: ReactElement) => void;
  clearScene: (id: string) => void;
}

const SceneContext = createContext<SceneCtx>({
  activeScene: null,
  transitioning: false,
  registerScene: () => {},
  clearScene: () => {},
});

export function useScene() {
  return useContext(SceneContext);
}

export function SceneProvider({ children }: { children: ReactNode }) {
  const [activeScene, setActiveScene] = useState<SceneEntry | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const registerScene = useCallback(
    (id: string, content: ReactElement) => {
      // If same scene re-registered, skip transition
      if (activeScene?.id === id) {
        setActiveScene({ id, content });
        return;
      }
      // Crossfade: fade out current, swap, fade in
      setTransitioning(true);
      setTimeout(() => {
        setActiveScene({ id, content });
        setTransitioning(false);
      }, 400);
    },
    [activeScene?.id]
  );

  const clearScene = useCallback(
    (id: string) => {
      if (activeScene?.id === id) {
        setTransitioning(true);
        setTimeout(() => {
          setActiveScene(null);
          setTransitioning(false);
        }, 400);
      }
    },
    [activeScene?.id]
  );

  return (
    <SceneContext.Provider
      value={{ activeScene, transitioning, registerScene, clearScene }}
    >
      {children}
    </SceneContext.Provider>
  );
}
