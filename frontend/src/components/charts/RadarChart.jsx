import {
  Radar,
  RadarChart as RC,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ATTRIBUTES } from "../../lib/attributes";

function makeTick(players, byLabel, showNumbers) {
  return function AxisTick({ x, y, cx, cy, payload }) {
    const row = byLabel[payload.value] || {};
    const ox = x + (x - cx) * 0.3;
    const oy = y + (y - cy) * 0.3;
    return (
      <g>
        <text
          x={ox}
          y={oy}
          textAnchor="middle"
          fill="#ffffff99"
          fontSize={14}
          fontFamily="JetBrains Mono"
        >
          {payload.value}
        </text>
        {showNumbers &&
          players.map((p, i) => (
            <text
              key={i}
              x={ox}
              y={oy + 17 + i * 15}
              textAnchor="middle"
              fill={p.color}
              fontSize={13}
              fontFamily="JetBrains Mono"
            >
              {Math.round((row[`raw${i}`] ?? 0) * 100)}
            </text>
          ))}
      </g>
    );
  };
}

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
            <span>{Math.round((row[`raw${idx}`] ?? 0) * 100)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RadarChart({ players }) {
  // Single player (profile): show ratings under each metric label.
  // Multiple players (comparison): keep labels clean, reveal ratings on hover.
  const showNumbers = players.length === 1;
  const byLabel = {};
  const data = ATTRIBUTES.map(({ key, label }) => {
    const row = { attr: label };
    players.forEach((p, i) => {
      const raw = p.values[key] ?? 0;
      row[`v${i}`] = raw;
      row[`raw${i}`] = raw;
    });
    byLabel[label] = row;
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RC data={data} outerRadius="62%">
        <PolarGrid stroke="#ffffff22" />
        <PolarAngleAxis dataKey="attr" tick={makeTick(players, byLabel, showNumbers)} />
        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
        {players.map((p, i) => (
          <Radar
            key={i}
            name={p.name}
            dataKey={`v${i}`}
            stroke={p.color}
            fill={p.color}
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        ))}
        {!showNumbers && <Tooltip content={<CustomTooltip />} cursor={false} />}
      </RC>
    </ResponsiveContainer>
  );
}
