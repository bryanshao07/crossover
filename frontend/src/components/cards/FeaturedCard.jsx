import { Link } from "react-router-dom";
import { pct } from "../../lib/format";
import Avatar from "../ui/Avatar";

export default function FeaturedCard({ a, b, similarity }) {
  return (
    <Link
      to={`/compare/${encodeURIComponent(a.name)}/${encodeURIComponent(b.name)}`}
      className="glass p-4 flex items-center gap-3 hover:border-accent/50"
    >
      <Avatar sport={a.sport} size={32} />
      <div className="text-sm">
        <div>{a.name}</div>
        <div className="text-white/50">{b.name}</div>
      </div>
      <span className="ml-auto font-mono text-accent">{pct(similarity)}</span>
      <Avatar sport={b.sport} size={32} />
    </Link>
  );
}
