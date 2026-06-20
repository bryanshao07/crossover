import { Link } from "react-router-dom";
import { pct } from "../../lib/format";
import Avatar from "../ui/Avatar";

export default function FeaturedCard({ a, b, similarity }) {
  return (
    <Link
      to={`/compare/${encodeURIComponent(a.name)}/${encodeURIComponent(b.name)}`}
      className="glass px-3 py-3 w-44 flex flex-col items-center text-center hover:border-accent/50 transition-colors"
    >
      <div className="flex items-center justify-center gap-2 w-full">
        <Avatar sport={a.sport} src={a.headshot_url} size={14} />
        <span className="text-white/40 text-xs">×</span>
        <Avatar sport={b.sport} src={b.headshot_url} size={14} />
      </div>
      <div className="mt-1.5 flex items-start justify-center gap-2 w-full text-xs text-white/80">
        <span className="flex-1 min-w-0 truncate">{a.name}</span>
        <span className="flex-1 min-w-0 truncate">{b.name}</span>
      </div>
      <div className="mt-2 font-mono text-[10px] tracking-[0.18em] text-white/40">
        SIMILARITY
      </div>
      <div className="font-mono text-accent text-xl leading-tight">
        {pct(similarity)}
      </div>
    </Link>
  );
}
