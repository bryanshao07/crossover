const SPORT_COLOR = { basketball: "#4a7fff", soccer: "#39d353" };

export default function HoverTooltip({ hovered, x, y }) {
  if (!hovered) return null;
  const color = SPORT_COLOR[hovered.sport] ?? "#4a7fff";
  const sportLabel = hovered.sport === "basketball" ? "NBA" : "SOC";
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: x + 12, top: y + 12,
        padding: "7px 10px",
        background: "rgba(10,10,15,0.95)",
        border: `1px solid ${color}`,
        backdropFilter: "blur(8px)",
        minWidth: 150,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>
        {hovered.name}
        <span style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700,
          color, border: `1px solid ${color}`, padding: "0 5px",
          background: `${color}1a`,
        }}>
          {sportLabel}
        </span>
      </div>
      {hovered.dna && (
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#e8ff47", marginTop: 4 }}>
          {hovered.dna}
        </div>
      )}
    </div>
  );
}
