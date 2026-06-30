import { createContext, useCallback, useContext, useRef, useState } from "react";

const TransitionContext = createContext(null);

export function TransitionProvider({ children }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [universeMode, setUniverseMode] = useState("background");
  const timerRef = useRef(null);
  const modeTimerRef = useRef(null);

  const startUniverseTransition = useCallback((callback) => {
    if (timerRef.current) return; // guard against double-clicks
    setIsTransitioning(true);

    // Phase 2 at 200ms: camera starts moving before the route changes
    modeTimerRef.current = setTimeout(() => {
      modeTimerRef.current = null;
      setUniverseMode("active");
    }, 200);

    // Phase 3 at 500ms: trigger route change
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsTransitioning(false);
      callback();
    }, 500);
  }, []);

  return (
    <TransitionContext.Provider value={{ isTransitioning, startUniverseTransition, universeMode, setUniverseMode }}>
      {children}
    </TransitionContext.Provider>
  );
}

export function useTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error("useTransition must be used inside TransitionProvider");
  return ctx;
}
