import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayers } from "../../hooks/usePlayers";
import SportBadge from "../ui/SportBadge";

const SPORT_OPTIONS = [
  { key: "all", label: "All Players", color: "#e8ff47" },
  { key: "basketball", label: "NBA", color: "#4a7fff" },
  { key: "soccer", label: "Soccer", color: "#39d353" },
];

export default function Autocomplete({
  onSelect,
  sportFilter = "all",
  onSportChange,
  placeholder = "Search a player…",
  size = "md",
  leadingIcon = false,
  kbd,
}) {
  const { data: players = [] } = usePlayers();
  const [q, setQ] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const [filterOpen, setFilterOpen] = useState(false);
  const inputRef = useRef(null);
  const filterRef = useRef(null);

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

  // Close the sport filter menu when clicking outside of it
  useEffect(() => {
    if (!filterOpen) return;
    function onPointerDown(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [filterOpen]);

  function clearQuery() {
    setQ("");
    inputRef.current?.focus();
  }

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

  const lg = size === "lg";
  const canFilter = typeof onSportChange === "function";

  return (
    <div className={`relative w-full ${lg ? "max-w-2xl" : "max-w-xl"}`}>
      <div className="relative">
        {leadingIcon && (
          <svg
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-white/40 ${
              lg ? "left-5 w-5 h-5" : "left-3 w-4 h-4"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-autocomplete="list"
          aria-label="Search players"
          className={`w-full bg-white/5 border border-white/15 rounded outline-none focus:border-accent font-sans text-white placeholder-white/40 ${
            lg ? "text-lg py-4" : "py-3"
          } ${leadingIcon ? (lg ? "pl-14" : "pl-10") : lg ? "pl-5" : "px-4"} ${
            canFilter || kbd ? (lg ? "pr-32" : "pr-28") : lg ? "pr-5" : "px-4"
          }`}
        />

        <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-2 ${lg ? "right-4" : "right-3"}`}>
          {canFilter && (
            <div ref={filterRef} className="relative">
              <button
                type="button"
                aria-label="Filter by sport"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-white/50 hover:text-white/90"
              >
                {sportFilter !== "all" && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: SPORT_OPTIONS.find((s) => s.key === sportFilter)?.color }}
                  />
                )}
                <svg
                  className={`w-4 h-4 transition-transform ${filterOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {filterOpen && (
                <ul className="absolute right-0 top-full z-[60] mt-2 min-w-[10rem] glass py-1">
                  {SPORT_OPTIONS.map((s) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => { onSportChange(s.key); setFilterOpen(false); inputRef.current?.focus(); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10 text-white/70"
                        style={sportFilter === s.key ? { color: s.color } : undefined}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        {s.label}
                        {sportFilter === s.key && <span className="ml-auto">✓</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {canFilter && (q || kbd) && <span className="w-px h-5 bg-white/15" />}

          {q ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearQuery}
              className="p-0.5 text-white/40 hover:text-white/90"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : kbd ? (
            <span className="font-mono text-xs text-white/40 border border-white/15 rounded-sm px-2 py-0.5">{kbd}</span>
          ) : null}
        </div>
      </div>
      {matches.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 glass max-h-[calc(90vh-26rem)] overflow-auto">
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
