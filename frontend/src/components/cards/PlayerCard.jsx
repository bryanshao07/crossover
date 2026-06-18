import { Link } from "react-router-dom";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";
import DnaLabel from "../ui/DnaLabel";

export default function PlayerCard({ player }) {
  return (
    <Link to={`/player/${encodeURIComponent(player.name)}`} className="glass p-4 hover:border-accent/50">
      <div className="flex items-center gap-3">
        <Avatar sport={player.sport} />
        <div className="min-w-0">
          <div className="truncate font-medium">{player.name}</div>
          <div className="flex items-center gap-2 mt-1"><SportBadge sport={player.sport} /><span className="font-mono text-xs text-white/50">{player.position}</span></div>
        </div>
      </div>
      <DnaLabel dna={player.dna} className="block mt-3 text-xs" />
    </Link>
  );
}
