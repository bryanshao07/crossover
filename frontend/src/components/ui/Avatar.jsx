import { SPORT_COLOR } from "../../lib/attributes";

export default function Avatar({ sport, size = 40 }) {
  return (
    <div
      className="rounded-full shrink-0"
      style={{ width: size, height: size, backgroundColor: SPORT_COLOR[sport] }}
    />
  );
}
