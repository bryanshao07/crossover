import { useMemo, useState } from "react";
import { usePlayers } from "../../hooks/usePlayers";
import SportBadge from "../ui/SportBadge";

export default function Autocomplete({ onSelect, sportFilter = "all", placeholder = "Search a player…" }) {
  const { data: players = [] } = usePlayers();
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (!q) return [];
    const ql = q.toLowerCase();
    return players
      .filter((p) => (sportFilter === "all" || p.sport === sportFilter) && p.name.toLowerCase().includes(ql))
      .slice(0, 8);
  }, [q, players, sportFilter]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/15 rounded px-4 py-3 outline-none focus:border-accent font-sans text-white placeholder-white/40"
      />
      {matches.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full glass max-h-80 overflow-auto">
          {matches.map((p) => (
            <li key={p.name}>
              <button
                onClick={() => { setQ(""); onSelect(p.name); }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-left"
              >
                <SportBadge sport={p.sport} />
                <span>{p.name}</span>
                <span className="ml-auto text-white/40 font-mono text-xs">{p.position}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
