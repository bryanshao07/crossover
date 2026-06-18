import RadarChart from "./RadarChart";
import { SPORT_COLOR } from "../../lib/attributes";

export default function OverlapRadarChart({ a, b }) {
  return (
    <RadarChart
      players={[
        { name: a.name, color: SPORT_COLOR[a.sport], values: a },
        { name: b.name, color: SPORT_COLOR[b.sport], values: b },
      ]}
    />
  );
}
