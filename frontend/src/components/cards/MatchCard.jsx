import { Link } from "react-router-dom";
import { pct } from "../../lib/format";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";
import DnaLabel from "../ui/DnaLabel";
import FavoriteButton from "../ui/FavoriteButton";

export default function MatchCard({ match, playerA }) {
  const to = playerA
    ? `/compare/${encodeURIComponent(playerA)}/${encodeURIComponent(match.name)}`
    : `/player/${encodeURIComponent(match.name)}`;
  return (
    <Link to={to} className="glass p-4 flex items-center gap-3 hover:border-accent/50 overflow-hidden h-full transition-transform transition-colors duration-150 hover:scale-[1.02]">
      <Avatar sport={match.sport} src={match.headshot_url} size={48} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-medium">{match.name}</span>
          <SportBadge sport={match.sport} className="shrink-0" />
          <span className="text-white/40 font-mono text-xs shrink-0">{match.position}</span>
        </div>
        <DnaLabel dna={match.dna} className="text-xs truncate block" />
      </div>
      <FavoriteButton playerName={match.name} />
      <span className="shrink-0 font-mono text-accent text-lg">{pct(match.similarity)}</span>
    </Link>
  );
}
