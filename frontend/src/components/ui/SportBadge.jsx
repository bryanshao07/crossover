import { SPORT_COLOR, SPORT_LABEL } from "../../lib/attributes";

export default function SportBadge({ sport }) {
  const color = SPORT_COLOR[sport];
  return (
    <span
      className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-sm border"
      style={{ color, borderColor: color, backgroundColor: `${color}1a` }}
    >
      {SPORT_LABEL[sport]}
    </span>
  );
}
