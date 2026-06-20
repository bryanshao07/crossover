import { Link } from "react-router-dom";
import { pct } from "../../lib/format";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";
import DnaLabel from "../ui/DnaLabel";

export default function MatchCard({ match, playerA }) {
  const to = playerA
    ? `/compare/${encodeURIComponent(playerA)}/${encodeURIComponent(match.name)}`
    : `/player/${encodeURIComponent(match.name)}`;
  return (
    <Link to={to} className="glass p-4 flex items-center gap-3 hover:border-accent/50">
      <Avatar sport={match.sport} src={match.headshot_url} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{match.name}</span>
          <SportBadge sport={match.sport} />
          <span className="text-white/40 font-mono text-xs">{match.position}</span>
        </div>
        <DnaLabel dna={match.dna} className="text-xs" />
      </div>
      <span className="ml-auto font-mono text-accent text-lg">{pct(match.similarity)}</span>
    </Link>
  );
}
