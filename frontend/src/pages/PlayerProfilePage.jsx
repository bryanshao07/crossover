import { useParams } from "react-router-dom";
import { usePlayer } from "../hooks/usePlayer";
import RadarChart from "../components/charts/RadarChart";
import MatchCard from "../components/cards/MatchCard";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { ATTRIBUTES, SPORT_COLOR } from "../lib/attributes";
import { ATTRIBUTE_ICONS } from "../lib/attributeIcons";

function AttributeScores({ player }) {
  const sportColor = SPORT_COLOR[player.sport];
  return (
    <section className="glass p-5">
      <h2 className="font-mono text-xs text-white/50 mb-4 uppercase tracking-wider">Attribute Scores</h2>
      <div className="grid gap-3">
        {ATTRIBUTES.map(({ key, displayLabel }) => {
          const score = Math.round((player[key] ?? 0) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-white/40 shrink-0">{ATTRIBUTE_ICONS[key]}</span>
              <span
                className="font-mono text-xs text-white/50 uppercase shrink-0"
                style={{ width: "9rem" }}
              >
                {displayLabel}
              </span>
              <div className="flex-1 h-1 rounded-full bg-white/10">
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${score}%`, backgroundColor: sportColor }}
                />
              </div>
              <span
                className="font-mono text-lg font-bold shrink-0 text-right"
                style={{ color: "#e8ff47", width: "2.5rem" }}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatBox({ label, value, subLabel }) {
  const display = value == null ? "—" : String(value).slice(0, 4);
  return (
    <div className="glass p-3 flex flex-col gap-0.5">
      <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <span className="font-mono text-xl font-bold text-white leading-tight">{display}</span>
      {subLabel && (
        <span className="font-mono text-[9px] text-white/30 uppercase tracking-wider">{subLabel}</span>
      )}
    </div>
  );
}

function PlayerSnapshot({ player, className = "" }) {
  const isNBA = player.sport === "basketball";
  const boxes = isNBA
    ? [
        { label: "AGE", value: player.age },
        { label: "TEAM", value: player.team },
        { label: "POS", value: player.pos },
        { label: "PTS", value: player.pts_per_game, subLabel: "PER GAME" },
        { label: "AST", value: player.ast_per_game, subLabel: "PER GAME" },
        { label: "TRB", value: player.trb_per_game, subLabel: "PER GAME" },
      ]
    : [
        { label: "AGE", value: player.age },
        { label: "TEAM", value: player.team },
        { label: "NATION", value: player.nation },
        { label: "POS", value: player.pos },
        { label: "GOALS", value: player.goals },
        { label: "ASSISTS", value: player.assists },
      ];

  return (
    <section className={`glass p-5 ${className}`}>
      <h2 className="font-mono text-xs text-white/50 mb-4 uppercase tracking-wider">Player Snapshot</h2>
      <div className="grid grid-cols-3 gap-2">
        {boxes.map(({ label, value, subLabel }) => (
          <StatBox key={label} label={label} value={value} subLabel={subLabel} />
        ))}
      </div>
    </section>
  );
}

function PlayerProfileSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-6 grid md:grid-cols-[5fr_4fr_5fr] gap-4">
      {/* Left: hero card */}
      <section className="glass p-6 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="w-20 h-20 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/5" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-10 shrink-0" />
              <Skeleton className="h-3 w-8 shrink-0" />
            </div>
          </div>
        </div>
        <div className="min-h-[3.75rem] space-y-1.5">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-5 w-4/5" />
        </div>
        <Skeleton className="mt-4 h-64 w-full" />
      </section>

      {/* Middle: attribute scores + snapshot */}
      <div className="flex flex-col gap-4 h-full min-w-0">
        <section className="glass p-5">
          <Skeleton className="h-3 w-32 mb-4" />
          <div className="grid gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-4 h-4 shrink-0" />
                <Skeleton className="h-2.5 shrink-0" style={{ width: "9rem" }} />
                <Skeleton className="flex-1 h-1" />
                <Skeleton className="h-6 w-9 shrink-0" />
              </div>
            ))}
          </div>
        </section>
        <section className="glass p-5 flex-1">
          <Skeleton className="h-3 w-32 mb-4" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass p-3 flex flex-col gap-1.5">
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right: match cards */}
      <section className="glass p-6 min-w-0 flex flex-col">
        <Skeleton className="h-3 w-36 mb-4 shrink-0" />
        <div className="flex flex-col flex-1 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass p-4 flex items-center gap-3 flex-1">
              <Skeleton className="w-12 h-12 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-10 shrink-0" />
                </div>
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="h-5 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function PlayerProfilePage() {
  const { name } = useParams();
  const { data, isLoading, isError } = usePlayer(decodeURIComponent(name));

  if (isLoading) return <PlayerProfileSkeleton />;
  if (isError || !data) return <div className="p-8 text-white/60">Player not found.</div>;

  const { player, matches } = data;
  return (
    <div className="max-w-7xl mx-auto p-6 grid md:grid-cols-[5fr_4fr_5fr] gap-4">
      <section className="glass p-6 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <Avatar sport={player.sport} src={player.headshot_url} size={80} />
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <SportBadge sport={player.sport} />
              <span className="font-mono text-xs text-white/50">{player.position}</span>
            </div>
          </div>
        </div>
        <div className="min-h-[3.75rem]">
          <DnaLabel dna={player.dna} />
        </div>
        <div className="mt-4">
          <RadarChart players={[{ name: player.name, color: SPORT_COLOR[player.sport], values: player }]} />
        </div>
      </section>
      <div className="flex flex-col gap-4 h-full min-w-0">
        <AttributeScores player={player} />
        <PlayerSnapshot player={player} className="flex-1" />
      </div>
      <section className="glass p-6 min-w-0 flex flex-col">
        <h2 className="font-mono text-xs text-white/50 mb-4 uppercase shrink-0">Top cross-sport matches</h2>
        <div className="flex flex-col flex-1 gap-3">
          {matches.slice(0, 5).map((m) => (
            <div key={m.name} className="flex-1 min-h-0">
              <MatchCard match={m} playerA={player.name} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
