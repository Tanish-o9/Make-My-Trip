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
  canvasError: boolean;
  registerScene: (id: string, content: ReactElement) => void;
  clearScene: (id: string) => void;
  setCanvasError: (val: boolean) => void;
}

const SceneContext = createContext<SceneCtx>({
  activeScene: null,
  transitioning: false,
  canvasError: false,
  registerScene: () => {},
  clearScene: () => {},
  setCanvasError: () => {},
});

export function useScene() {
  return useContext(SceneContext);
}

export function SceneProvider({ children }: { children: ReactNode }) {
  const [activeScene, setActiveScene] = useState<SceneEntry | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [canvasError, setCanvasError] = useState(false);

  const registerScene = useCallback(
    (id: string, content: ReactElement) => {
      if (activeScene?.id === id) {
        setActiveScene({ id, content });
        return;
      }
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
      value={{
        activeScene,
        transitioning,
        canvasError,
        registerScene,
        clearScene,
        setCanvasError,
      }}
    >
      {children}
    </SceneContext.Provider>
  );
}
