import { useCallback, useMemo, useState } from "react";
import { useUniverse } from "../hooks/useUniverse";
import UniverseScene from "../components/universe/UniverseScene";
import ControlPanel from "../components/universe/ControlPanel";
import HoverTooltip from "../components/universe/HoverTooltip";
import PlayerPopup from "../components/universe/PlayerPopup";

export default function UniversePage() {
  const { data = [] } = useUniverse();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [colorBy, setColorBy] = useState("sport");
  const [hovered, setHovered] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedPlayer, setSelectedPlayer] = useState(null);

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

  const onSelect = useCallback((n) => setSelectedPlayer(n), []);

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
      />
      <UniverseScene
        points={points}
        colorBy={colorBy}
        onHover={onHover}
        onSelect={onSelect}
      />
      <HoverTooltip hovered={hovered} x={pos.x} y={pos.y} />
      {selectedPlayer && (
        <PlayerPopup playerName={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
