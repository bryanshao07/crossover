import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUniverse } from "../hooks/useUniverse";
import UniverseScene from "../components/universe/UniverseScene";
import ControlPanel from "../components/universe/ControlPanel";
import HoverTooltip from "../components/universe/HoverTooltip";

export default function UniversePage() {
  const { data = [] } = useUniverse();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [colorBy, setColorBy] = useState("sport");
  const [hovered, setHovered] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const points = useMemo(
    () =>
      data.filter(
        (p) =>
          (sport === "all" || p.sport === sport) &&
          (!query || p.name.toLowerCase().includes(query.toLowerCase()))
      ),
    [data, sport, query]
  );

  const onHover = useCallback((p, e) => {
    setHovered(p);
    if (e) setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const onSelect = useCallback(
    (n) => navigate(`/player/${encodeURIComponent(n)}`),
    [navigate]
  );

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
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
    </div>
  );
}
