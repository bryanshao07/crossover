import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUniverse } from "../hooks/useUniverse";
import { usePlayer } from "../hooks/usePlayer";

const UniverseContext = createContext(null);

function computeCentroid(data) {
  if (!data.length) return { x: 0, y: 0, z: 0 };
  const sum = data.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
    { x: 0, y: 0, z: 0 }
  );
  return { x: sum.x / data.length, y: sum.y / data.length, z: sum.z / data.length };
}

function applyTransform(data, centroid) {
  return data.map((p) => ({
    ...p,
    x: (p.x - centroid.x) * 2.2,
    y: (p.y - centroid.y) * 2.2,
    z: (p.z - centroid.z) * 2.2,
  }));
}

export function UniverseProvider({ children }) {
  const navigate = useNavigate();
  const { data: rawData = [] } = useUniverse();

  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [colorBy, setColorBy] = useState("sport");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [edgeIndicators, setEdgeIndicators] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const resetZoomRef = useRef(null);

  const centroid = useMemo(() => computeCentroid(rawData), [rawData]);

  // All points transformed — used for background mode (no filter)
  const bgPoints = useMemo(() => applyTransform(rawData, centroid), [rawData, centroid]);

  // Filtered + transformed points — used for active mode
  const activePoints = useMemo(
    () =>
      applyTransform(
        rawData.filter(
          (p) =>
            (sport === "all" || p.sport === sport) &&
            (!query || p.name.toLowerCase().includes(query.toLowerCase()))
        ),
        centroid
      ),
    [rawData, sport, query, centroid]
  );

  const { data: playerData } = usePlayer(selectedPlayer?.name);

  const matchConnections = useMemo(() => {
    if (!playerData || !selectedPlayer) return [];
    const allTransformed = applyTransform(rawData, centroid);
    return (playerData.matches ?? []).slice(0, 5).flatMap((m) => {
      const pt = allTransformed.find((p) => p.name === m.name);
      return pt ? [{ name: m.name, to: pt, similarity: m.similarity }] : [];
    });
  }, [playerData, selectedPlayer, rawData, centroid]);

  const onHover = useCallback((p, e) => {
    setHovered(p);
    if (e) setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const onSelect = useCallback((p) => setSelectedPlayer(p), []);

  const onMatchClick = useCallback(
    (matchName) => {
      if (!selectedPlayer) return;
      navigate(`/compare/${encodeURIComponent(selectedPlayer.name)}/${encodeURIComponent(matchName)}`);
    },
    [navigate, selectedPlayer]
  );

  return (
    <UniverseContext.Provider
      value={{
        rawData,
        bgPoints,
        activePoints,
        query, setQuery,
        sport, setSport,
        colorBy, setColorBy,
        selectedPlayer, setSelectedPlayer,
        edgeIndicators, setEdgeIndicators,
        hovered,
        pos,
        onHover,
        onSelect,
        onMatchClick,
        resetZoomRef,
        matchConnections,
      }}
    >
      {children}
    </UniverseContext.Provider>
  );
}

export function useUniverseContext() {
  const ctx = useContext(UniverseContext);
  if (!ctx) throw new Error("useUniverseContext must be inside UniverseProvider");
  return ctx;
}
