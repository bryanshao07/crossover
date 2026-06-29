import { motion } from "framer-motion";
import NavBar from "./NavBar";
import UniverseScene from "../universe/UniverseScene";
import { useTransition } from "../../context/TransitionContext";
import { useUniverseContext } from "../../context/UniverseContext";

const EASE = [0.4, 0, 0.2, 1];

function PersistentUniverse() {
  const { universeMode } = useTransition();
  const {
    bgPoints,
    activePoints,
    colorBy,
    onHover,
    onSelect,
    selectedPlayer,
    matchConnections,
    setEdgeIndicators,
    onMatchClick,
    resetZoomRef,
  } = useUniverseContext();

  const isActive = universeMode === "active";
  const points = isActive ? activePoints : bgPoints;

  return (
    <div
      className="fixed inset-0 z-0"
      style={{ pointerEvents: isActive ? "auto" : "none" }}
    >
      <UniverseScene
        mode={universeMode}
        points={points}
        colorBy={colorBy}
        onHover={isActive ? onHover : () => {}}
        onSelect={isActive ? onSelect : () => {}}
        selectedPlayer={isActive ? selectedPlayer : null}
        matchConnections={isActive ? matchConnections : []}
        onEdgeUpdate={isActive ? setEdgeIndicators : () => {}}
        onMatchClick={isActive ? onMatchClick : () => {}}
        resetZoomRef={resetZoomRef}
      />

      {/* Dim overlay: fades away when active, present when background */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "#0a0a0f" }}
        animate={{ opacity: isActive ? 0 : 0.78 }}
        transition={{ duration: 0.6, ease: EASE }}
      />
    </div>
  );
}

export default function PageShell({ children }) {
  return (
    <div className="min-h-screen text-white" style={{ background: "transparent" }}>
      <PersistentUniverse />
      <div className="relative z-10 flex flex-col min-h-screen" style={{ background: "transparent" }}>
        <NavBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
