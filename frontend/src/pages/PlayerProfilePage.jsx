import { useParams } from "react-router-dom";
import { usePlayer } from "../hooks/usePlayer";
import RadarChart from "../components/charts/RadarChart";
import MatchCard from "../components/cards/MatchCard";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { SPORT_COLOR } from "../lib/attributes";

const ATTR_ROWS = [
  {
    key: "scoring",
    label: "SCORING",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    key: "playmaking",
    label: "PLAYMAKING",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M4 12a8 8 0 0 1 8-8" strokeLinecap="round" />
        <path d="M20 12a8 8 0 0 1-8 8" strokeLinecap="round" />
        <path d="M9 4l3-3 3 3M15 20l-3 3-3-3" />
      </svg>
    ),
  },
  {
    key: "defensive_impact",
    label: "DEFENSIVE IMPACT",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M12 3L4 7v6c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7l-8-4z" />
      </svg>
    ),
  },
  {
    key: "efficiency",
    label: "EFFICIENCY",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "versatility",
    label: "VERSATILITY",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 12h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "physical_dominance",
    label: "PHYSICAL DOMINANCE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M6 4h2v4H6zM16 4h2v4h-2zM4 6h16M8 8h8v8H8zM6 16h2v4H6zM16 16h2v4h-2zM4 18h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "durability",
    label: "DURABILITY",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
];

function AttributeScores({ player }) {
  const sportColor = SPORT_COLOR[player.sport];
  return (
    <section className="glass p-5">
      <h2 className="font-mono text-xs text-white/50 mb-4 uppercase tracking-wider">Attribute Scores</h2>
      <div className="grid gap-3">
        {ATTR_ROWS.map(({ key, label, icon }) => {
          const score = Math.round((player[key] ?? 0) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-white/40 shrink-0">{icon}</span>
              <span
                className="font-mono text-xs text-white/50 uppercase shrink-0"
                style={{ width: "9rem" }}
              >
                {label}
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

export default function PlayerProfilePage() {
  const { name } = useParams();
  const { data, isLoading, isError } = usePlayer(decodeURIComponent(name));

  if (isLoading) return <div className="p-8 grid gap-4"><Skeleton className="h-40" /><Skeleton className="h-80" /></div>;
  if (isError || !data) return <div className="p-8 text-white/60">Player not found.</div>;

  const { player, matches } = data;
  return (
    <div className="max-w-7xl mx-auto p-6 grid md:grid-cols-[5fr_4fr_5fr] gap-4">
      <section className="glass p-6">
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
        <DnaLabel dna={player.dna} />
        <div className="mt-4">
          <RadarChart players={[{ name: player.name, color: SPORT_COLOR[player.sport], values: player }]} />
        </div>
      </section>
      <div className="flex flex-col gap-4 h-full">
        <AttributeScores player={player} />
        <PlayerSnapshot player={player} className="flex-1" />
      </div>
      <section>
        <h2 className="font-mono text-xs text-white/50 mb-3 uppercase">Top cross-sport matches</h2>
        <div className="grid gap-3">
          {matches.slice(0, 5).map((m) => <MatchCard key={m.name} match={m} playerA={player.name} />)}
        </div>
      </section>
    </div>
  );
}
