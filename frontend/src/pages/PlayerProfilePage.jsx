import { useParams } from "react-router-dom";
import { usePlayer } from "../hooks/usePlayer";
import RadarChart from "../components/charts/RadarChart";
import MatchCard from "../components/cards/MatchCard";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { SPORT_COLOR } from "../lib/attributes";

export default function PlayerProfilePage() {
  const { name } = useParams();
  const { data, isLoading, isError } = usePlayer(decodeURIComponent(name));

  if (isLoading) return <div className="p-8 grid gap-4"><Skeleton className="h-40" /><Skeleton className="h-80" /></div>;
  if (isError || !data) return <div className="p-8 text-white/60">Player not found.</div>;

  const { player, matches } = data;
  return (
    <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-6">
      <section className="glass p-6">
        <div className="flex items-center gap-3 mb-3">
          <Avatar sport={player.sport} size={56} />
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <SportBadge sport={player.sport} />
              <span className="font-mono text-xs text-white/50">{player.position}</span>
            </div>
          </div>
        </div>
        <DnaLabel dna={player.dna} />
        <div className="mt-4">
          <RadarChart players={[{ name: player.name, color: SPORT_COLOR[player.sport], values: player }]} />
        </div>
      </section>
      <section>
        <h2 className="font-mono text-xs text-white/50 mb-3 uppercase">Top cross-sport matches</h2>
        <div className="grid gap-3">
          {matches.slice(0, 5).map((m) => <MatchCard key={m.name} match={m} playerA={player.name} />)}
        </div>
      </section>
    </div>
  );
}
