import { Radar, RadarChart as RC, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { ATTRIBUTES } from "../../lib/attributes";

export default function RadarChart({ players }) {
  const data = ATTRIBUTES.map(({ key, label }) => {
    const row = { attr: label };
    players.forEach((p, i) => { row[`v${i}`] = p.values[key]; });
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RC data={data} outerRadius="75%">
        <PolarGrid stroke="#ffffff22" />
        <PolarAngleAxis dataKey="attr" tick={{ fill: "#ffffff99", fontSize: 10, fontFamily: "JetBrains Mono" }} />
        {players.map((p, i) => (
          <Radar key={i} dataKey={`v${i}`} stroke={p.color} fill={p.color} fillOpacity={0.25} />
        ))}
      </RC>
    </ResponsiveContainer>
  );
}
