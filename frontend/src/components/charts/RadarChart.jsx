import { Radar, RadarChart as RC, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ATTRIBUTES } from "../../lib/attributes";

// Values are min-max scaled 0-1. A power < 1 expands the low/center range
// outward so the filled area reads larger without distorting the true rating.
const SCALE_EXP = 0.5;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: "#0a0a0fee",
        border: "1px solid #ffffff22",
        borderRadius: 3,
        padding: "8px 10px",
        fontFamily: "JetBrains Mono",
        fontSize: 11,
        backdropFilter: "blur(6px)",
      }}
    >
      <div style={{ color: "#e8ff47", marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
      {payload.map((entry, i) => {
        const idx = entry.dataKey.slice(1); // "v0" -> "0"
        return (
          <div
            key={i}
            style={{ color: entry.color, display: "flex", justifyContent: "space-between", gap: 16 }}
          >
            <span>{entry.name}</span>
            <span>{Math.round(row[`raw${idx}`] * 100)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RadarChart({ players }) {
  const data = ATTRIBUTES.map(({ key, label }) => {
    const row = { attr: label };
    players.forEach((p, i) => {
      const raw = p.values[key] ?? 0;
      row[`v${i}`] = Math.pow(raw, SCALE_EXP); // plotted (expanded) value
      row[`raw${i}`] = raw; // true rating for tooltip
    });
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RC data={data} outerRadius="75%">
        <PolarGrid stroke="#ffffff22" />
        <PolarAngleAxis dataKey="attr" tick={{ fill: "#ffffff99", fontSize: 10, fontFamily: "JetBrains Mono" }} />
        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
        {players.map((p, i) => (
          <Radar key={i} name={p.name} dataKey={`v${i}`} stroke={p.color} fill={p.color} fillOpacity={0.25} />
        ))}
        <Tooltip content={<CustomTooltip />} cursor={false} />
      </RC>
    </ResponsiveContainer>
  );
}
