import { useState } from "react";
import { useSearch } from "../hooks/useSearch";
import PlayerCard from "../components/cards/PlayerCard";
import FilterPill from "../components/ui/FilterPill";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "FW", "MF", "DF"];
const PAGE = 24;

export default function SearchResultsPage() {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(0);
  const { data = [] } = useSearch({ q, sport, position });
  const pages = Math.ceil(data.length / PAGE);
  const slice = data.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(0); }}
        placeholder="Search players…"
        className="w-full bg-white/5 border border-white/15 rounded px-4 py-3 outline-none focus:border-accent mb-4"
      />
      <div className="flex flex-wrap gap-2 mb-2">
        {["", "basketball", "soccer"].map((s) => (
          <FilterPill key={s || "all"} active={sport === s} onClick={() => { setSport(s); setPage(0); }}>
            {s === "" ? "ALL" : s === "basketball" ? "NBA" : "SOCCER"}
          </FilterPill>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill active={position === ""} onClick={() => { setPosition(""); setPage(0); }}>ALL POS</FilterPill>
        {POSITIONS.map((p) => (
          <FilterPill key={p} active={position === p} onClick={() => { setPosition(p); setPage(0); }}>{p}</FilterPill>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slice.map((p) => <PlayerCard key={p.name} player={p} />)}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 font-mono text-sm">
          <button disabled={page === 0} onClick={() => setPage((n) => n - 1)} className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30">Prev</button>
          <span className="text-white/50">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((n) => n + 1)} className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
