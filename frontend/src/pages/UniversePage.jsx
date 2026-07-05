import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ControlPanel from "../components/universe/ControlPanel";
import HoverTooltip from "../components/universe/HoverTooltip";
import PlayerPopup from "../components/universe/PlayerPopup";
import Skeleton from "../components/ui/Skeleton";
import { useTransition } from "../context/TransitionContext";
import { useUniverseContext } from "../context/UniverseContext";
import { useDelayedLoading } from "../hooks/useDelayedLoading";

const EASE = [0.4, 0, 0.2, 1];
const SPORT_PILL_COLORS = { basketball: "#4a7fff", soccer: "#39d353" };

function UniversePageSkeleton() {
  return (
    <div
      className="absolute inset-0 z-50"
      style={{ background: "#0a0a0f" }}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading universe"
    >
      {/* Left: skeleton ControlPanel — matches exact dimensions of the real panel */}
      <div
        className="absolute top-4 left-4 flex flex-col gap-7"
        style={{
          width: 280,
          background: "rgba(10,10,15,0.88)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "22px 20px",
        }}
      >
        {/* Search bar */}
        <Skeleton style={{ height: 34 }} />

        {/* Filter by sport */}
        <div className="flex flex-col gap-2">
          <Skeleton style={{ height: 10, width: 96 }} />
          <div className="flex gap-1.5">
            <Skeleton style={{ height: 28, width: 56 }} />
            <Skeleton style={{ height: 28, width: 56 }} />
            <Skeleton style={{ height: 28, width: 72 }} />
          </div>
        </div>

        {/* Color by */}
        <div className="flex flex-col gap-2">
          <Skeleton style={{ height: 10, width: 64 }} />
          <Skeleton style={{ height: 34 }} />
        </div>

        {/* View controls */}
        <div className="flex flex-col gap-2">
          <Skeleton style={{ height: 10, width: 88 }} />
          <div className="flex flex-col gap-2">
            <Skeleton style={{ height: 16, width: 80 }} />
            <Skeleton style={{ height: 16, width: 64 }} />
            <Skeleton style={{ height: 16, width: 56 }} />
          </div>
          <Skeleton style={{ height: 36, marginTop: 6 }} />
        </div>

        {/* Legend */}
        <div
          className="flex flex-col gap-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}
        >
          <Skeleton style={{ height: 12, width: 148 }} />
          <Skeleton style={{ height: 12, width: 168 }} />
          <Skeleton style={{ height: 12, width: 128 }} />
        </div>
      </div>

      {/* Canvas area: clean dark fill with minimal status hint */}
      <div
        className="absolute top-0 bottom-0 right-0 flex items-center justify-center"
        style={{ left: 312 }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.15)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Initializing universe
        </span>
      </div>
    </div>
  );
}

function EdgePill({ ind, onClick }) {
  const [hovered, setHovered] = useState(false);
  const color = SPORT_PILL_COLORS[ind.sport] ?? "#4a7fff";
  const sportLabel = ind.sport === "basketball" ? "NBA" : "SOC";
  return (
    <div className="absolute z-[9999] pointer-events-auto" style={{ left: ind.x, top: ind.y, transform: "translate(-50%, -50%)" }}>
      {hovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", pointerEvents: "none", zIndex: 100,
          padding: "7px 10px", background: "rgba(10,10,15,0.95)",
          border: `1px solid ${color}`, backdropFilter: "blur(8px)",
          minWidth: 150, whiteSpace: "nowrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>
            {ind.name}
            <span style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700,
              color, border: `1px solid ${color}`, padding: "0 5px", background: `${color}1a`,
            }}>
              {sportLabel}
            </span>
          </div>
          {ind.dna && (
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#e8ff47", marginTop: 4 }}>
              {ind.dna}
            </div>
          )}
        </div>
      )}
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600,
          color: hovered ? "#0a0a0f" : color,
          whiteSpace: "nowrap", padding: "2px 7px 2px 5px",
          border: `1px solid ${color}88`,
          background: hovered ? color : "rgba(10,10,15,0.88)",
          letterSpacing: "0.03em", userSelect: "none", cursor: "pointer",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: hovered ? "#0a0a0f" : color, flexShrink: 0 }} />
        {ind.name}
      </div>
    </div>
  );
}

export default function UniversePage() {
  const { setUniverseMode } = useTransition();
  const {
    rawData,
    isLoading,
    query, setQuery,
    sport, setSport,
    colorBy, setColorBy,
    selectedPlayer, setSelectedPlayer,
    edgeIndicators,
    hovered,
    pos,
    onMatchClick,
    resetZoomRef,
  } = useUniverseContext();
  const showSkeleton = useDelayedLoading(isLoading);

  // Activate the canvas on mount; restore background mode on unmount
  useEffect(() => {
    setUniverseMode("active");
    return () => setUniverseMode("background");
  }, [setUniverseMode]);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] pointer-events-none">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 65% 65% at 50% 50%, rgba(255,255,255,0.055) 0%, transparent 100%)" }}
      />

      {showSkeleton && <UniversePageSkeleton />}

      {/* Phase 4: ControlPanel drifts up into position */}
      <motion.div
        className="pointer-events-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3, ease: EASE }}
      >
        <ControlPanel
          query={query}
          setQuery={setQuery}
          sport={sport}
          setSport={setSport}
          colorBy={colorBy}
          setColorBy={setColorBy}
          onResetZoom={() => resetZoomRef.current?.()}
          data={rawData}
        />
      </motion.div>

      {selectedPlayer && edgeIndicators.map((ind) => (
        <EdgePill key={ind.name} ind={ind} onClick={() => onMatchClick(ind.name)} />
      ))}

      <HoverTooltip hovered={hovered} x={pos.x} y={pos.y} />

      {selectedPlayer && (
        <div className="pointer-events-auto">
          <PlayerPopup playerName={selectedPlayer.name} onClose={() => setSelectedPlayer(null)} />
        </div>
      )}
    </div>
  );
}
