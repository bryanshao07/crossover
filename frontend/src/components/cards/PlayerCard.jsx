import { Link } from "react-router-dom";
import SportBadge from "../ui/SportBadge";
import DnaLabel from "../ui/DnaLabel";
import { SPORT_COLOR } from "../../lib/attributes";

const CARD_ATTRIBUTES = [
  { key: "scoring", label: "SCORING" },
  { key: "playmaking", label: "PLAYMAKING" },
  { key: "defensive_impact", label: "DEF IMPACT" },
  { key: "efficiency", label: "EFFICIENCY" },
  { key: "versatility", label: "VERSATILITY" },
  { key: "physical_dominance", label: "PHYS DOM" },
  { key: "durability", label: "DURABILITY" },
];

export default function PlayerCard({ player }) {
  const color = SPORT_COLOR[player.sport];
  return (
    <div className="glass flex flex-col overflow-hidden p-4 transition-colors hover:border-accent/50">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold">{player.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <SportBadge sport={player.sport} />
            <span className="font-mono text-xs text-white/50">
              {player.position}
            </span>
          </div>
          <DnaLabel dna={player.dna} className="mt-3 block text-xs" />
        </div>

        <div className="grid w-44 shrink-0 content-start gap-1.5">
          {CARD_ATTRIBUTES.map((a) => {
            const value = Math.round((player[a.key] ?? 0) * 100);
            return (
              <div key={a.key} className="flex items-center gap-2">
                <span className="w-[4.5rem] shrink-0 font-mono text-[10px] uppercase tracking-wide text-white/50">
                  {a.label}
                </span>
                <span className="h-1 flex-1 rounded-sm bg-white/10">
                  <span
                    className="block h-full rounded-sm"
                    style={{ width: `${value}%`, backgroundColor: color }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right font-mono text-[11px] text-white/80">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Link
        to={`/player/${encodeURIComponent(player.name)}`}
        className="-mx-4 -mb-4 mt-4 border-t border-white/10 px-4 py-3 text-center font-mono text-sm text-accent transition-colors hover:bg-accent/10"
      >
        View Profile →
      </Link>
    </div>
  );
}
