import { useMemo, useState } from "react";
import { useSearch } from "../hooks/useSearch";
import PlayerCard from "../components/cards/PlayerCard";
import PlayerCardSkeleton from "../components/ui/PlayerCardSkeleton";
import FilterPill from "../components/ui/FilterPill";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "FW", "MF", "DF"];
const PAGE = 24;
const SPORT_PILLS = [
  { key: "", label: "ALL", color: "#e8ff47" },
  { key: "basketball", label: "NBA", color: "#4a7fff" },
  { key: "soccer", label: "SOCCER", color: "#39d353" },
];

export default function SearchResultsPage() {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(0);
  // Fetch every athlete matching the query + position (ignoring the sport
  // filter) so we can show a per-sport count on each pill, then filter for
  // display client-side.
  const { data = [], isLoading } = useSearch({ q, position });
  const counts = useMemo(
    () => ({
      "": data.length,
      basketball: data.filter((p) => p.sport === "basketball").length,
      soccer: data.filter((p) => p.sport === "soccer").length,
    }),
    [data],
  );
  const results = sport ? data.filter((p) => p.sport === sport) : data;
  const pages = Math.ceil(results.length / PAGE);
  const slice = results.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(0);
        }}
        placeholder="Search for a player"
        className="w-full bg-white/5 border border-white/15 rounded px-4 py-3 outline-none focus:border-accent mb-4"
      />
      <div className="flex flex-wrap gap-2 mb-2">
        {SPORT_PILLS.map((s) => (
          <FilterPill
            key={s.key || "all"}
            active={sport === s.key}
            color={s.color}
            onClick={() => {
              setSport(s.key);
              setPage(0);
            }}
          >
            {s.label} ({counts[s.key]})
          </FilterPill>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill
          active={position === ""}
          onClick={() => {
            setPosition("");
            setPage(0);
          }}
        >
          ALL POS
        </FilterPill>
        {POSITIONS.map((p) => (
          <FilterPill
            key={p}
            active={position === p}
            onClick={() => {
              setPosition(p);
              setPage(0);
            }}
          >
            {p}
          </FilterPill>
        ))}
      </div>
      <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <PlayerCardSkeleton key={i} />)
          : slice.map((p) => <PlayerCard key={p.name} player={p} />)}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 font-mono text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((n) => n - 1)}
            className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-white/50">
            {page + 1} / {pages}
          </span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((n) => n + 1)}
            className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
