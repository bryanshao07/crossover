import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUniverse } from "../hooks/useUniverse";
import { usePlayer } from "../hooks/usePlayer";
import UniverseScene from "../components/universe/UniverseScene";
import ControlPanel from "../components/universe/ControlPanel";
import HoverTooltip from "../components/universe/HoverTooltip";
import PlayerPopup from "../components/universe/PlayerPopup";

const SPORT_PILL_COLORS = { basketball: "#4a7fff", soccer: "#39d353" };

function EdgePill({ ind, onClick }) {
  const [hovered, setHovered] = useState(false);
  const color = SPORT_PILL_COLORS[ind.sport] ?? "#4a7fff";
  const sportLabel = ind.sport === "basketball" ? "NBA" : "SOC";
  return (
    <div className="absolute z-[9999]" style={{ left: ind.x, top: ind.y, transform: "translate(-50%, -50%)" }}>
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
  const navigate = useNavigate();
  const { data = [] } = useUniverse();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [colorBy, setColorBy] = useState("sport");
  const [hovered, setHovered] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [edgeIndicators, setEdgeIndicators] = useState([]);
  const resetZoomRef = useRef(null);

  const centroid = useMemo(() => {
    if (!data.length) return { x: 0, y: 0, z: 0 };
    const sum = data.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
      { x: 0, y: 0, z: 0 }
    );
    return { x: sum.x / data.length, y: sum.y / data.length, z: sum.z / data.length };
  }, [data]);

  const points = useMemo(
    () =>
      data
        .filter(
          (p) =>
            (sport === "all" || p.sport === sport) &&
            (!query || p.name.toLowerCase().includes(query.toLowerCase()))
        )
        .map((p) => ({ ...p, x: (p.x - centroid.x) * 2.2, y: (p.y - centroid.y) * 2.2, z: (p.z - centroid.z) * 2.2 })),
    [data, sport, query, centroid]
  );

  const onHover = useCallback((p, e) => {
    setHovered(p);
    if (e) setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const onSelect = useCallback((p) => setSelectedPlayer(p), []);

  const onMatchClick = useCallback((matchName) => {
    if (!selectedPlayer) return;
    navigate(`/compare/${encodeURIComponent(selectedPlayer.name)}/${encodeURIComponent(matchName)}`);
  }, [navigate, selectedPlayer]);

  const { data: playerData } = usePlayer(selectedPlayer?.name);

  const matchConnections = useMemo(() => {
    if (!playerData || !selectedPlayer || !data.length) return [];
    const allPoints = data.map((p) => ({
      ...p,
      x: (p.x - centroid.x) * 2.2,
      y: (p.y - centroid.y) * 2.2,
      z: (p.z - centroid.z) * 2.2,
    }));
    return (playerData.matches ?? []).slice(0, 5).flatMap((m) => {
      const pt = allPoints.find((p) => p.name === m.name);
      return pt ? [{ name: m.name, to: pt, similarity: m.similarity }] : [];
    });
  }, [playerData, selectedPlayer, data, centroid]);

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 65% 65% at 50% 50%, rgba(255,255,255,0.055) 0%, transparent 100%)" }}
      />
      <ControlPanel
        query={query}
        setQuery={setQuery}
        sport={sport}
        setSport={setSport}
        colorBy={colorBy}
        setColorBy={setColorBy}
        onResetZoom={() => resetZoomRef.current?.()}
        data={data}
      />
      <UniverseScene
        points={points}
        colorBy={colorBy}
        onHover={onHover}
        onSelect={onSelect}
        selectedPlayer={selectedPlayer}
        matchConnections={matchConnections}
        onEdgeUpdate={setEdgeIndicators}
        onMatchClick={onMatchClick}
        resetZoomRef={resetZoomRef}
      />
      {selectedPlayer && edgeIndicators.map((ind) => (
        <EdgePill key={ind.name} ind={ind} onClick={() => onMatchClick(ind.name)} />
      ))}
      <HoverTooltip hovered={hovered} x={pos.x} y={pos.y} />
      {selectedPlayer && (
        <PlayerPopup playerName={selectedPlayer.name} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
