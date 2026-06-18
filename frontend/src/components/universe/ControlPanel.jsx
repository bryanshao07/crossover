import FilterPill from "../ui/FilterPill";

export default function ControlPanel({ query, setQuery, sport, setSport, colorBy, setColorBy }) {
  return (
    <div className="absolute top-4 left-4 z-40 glass p-4 w-64 space-y-4">
      <div>
        <label className="font-mono text-xs text-white/50 uppercase">Search</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Highlight name…"
          className="mt-1 w-full bg-white/5 border border-white/15 rounded px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <div className="font-mono text-xs text-white/50 uppercase mb-1">Sport</div>
        <div className="flex gap-2">
          {["all", "basketball", "soccer"].map((s) => (
            <FilterPill key={s} active={sport === s} onClick={() => setSport(s)}>
              {s === "all" ? "ALL" : s === "basketball" ? "NBA" : "SOC"}
            </FilterPill>
          ))}
        </div>
      </div>
      <div>
        <div className="font-mono text-xs text-white/50 uppercase mb-1">Color by</div>
        <div className="flex gap-2">
          {["sport", "accent"].map((c) => (
            <FilterPill key={c} active={colorBy === c} onClick={() => setColorBy(c)}>
              {c.toUpperCase()}
            </FilterPill>
          ))}
        </div>
      </div>
    </div>
  );
}
