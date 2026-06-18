import { useEffect, useMemo, useState } from "react";
import { usePlayers } from "../../hooks/usePlayers";
import SportBadge from "../ui/SportBadge";

export default function Autocomplete({ onSelect, sportFilter = "all", placeholder = "Search a player…" }) {
  const { data: players = [] } = usePlayers();
  const [q, setQ] = useState("");
  const [highlighted, setHighlighted] = useState(-1);

  const matches = useMemo(() => {
    if (!q) return [];
    const ql = q.toLowerCase();
    return players
      .filter((p) => (sportFilter === "all" || p.sport === sportFilter) && p.name.toLowerCase().includes(ql))
      .slice(0, 8);
  }, [q, players, sportFilter]);

  // Reset highlight whenever query or matches change
  useEffect(() => {
    setHighlighted(-1);
  }, [q, matches]);

  function handleKeyDown(e) {
    if (matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((prev) => Math.min(prev + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      if (highlighted >= 0) {
        e.preventDefault();
        setQ("");
        onSelect(matches[highlighted].name);
      }
    } else if (e.key === "Escape") {
      setQ("");
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-autocomplete="list"
        aria-label="Search players"
        className="w-full bg-white/5 border border-white/15 rounded px-4 py-3 outline-none focus:border-accent font-sans text-white placeholder-white/40"
      />
      {matches.length > 0 && (
        <ul role="listbox" className="absolute z-50 mt-1 w-full glass max-h-80 overflow-auto">
          {matches.map((p, index) => (
            <li key={p.name} role="option" aria-selected={index === highlighted}>
              <button
                onClick={() => { setQ(""); onSelect(p.name); }}
                onMouseEnter={() => setHighlighted(index)}
                className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-left${index === highlighted ? " bg-white/10" : ""}`}
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
