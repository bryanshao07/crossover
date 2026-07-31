import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import PlayerCard from "../components/cards/PlayerCard";
import PlayerCardSkeleton from "../components/ui/PlayerCardSkeleton";
import FilterPill from "../components/ui/FilterPill";
import SearchModeToggle from "../components/ui/SearchModeToggle";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "FW", "MF", "DF"];
const PAGE = 24;
const SPORT_PILLS = [
  { key: "", label: "ALL", color: "#e8ff47" },
  { key: "basketball", label: "NBA", color: "#4a7fff" },
  { key: "soccer", label: "SOCCER", color: "#39d353" },
];

export default function SearchResultsPage() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [mode, setMode] = useState("keyword");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(0);

  const semantic = mode === "semantic";

  // Each semantic query is a live Gemini embedding call, so in semantic mode
  // only the *submitted* query feeds the react-query key -- typing cannot
  // refetch, because the live `q` is not part of the key at all. Keyword mode
  // keeps its live per-keystroke behaviour.
  const filters = semantic ? { q: submittedQ, mode: "semantic" } : { q };
  const { data = [], isLoading, isFetching } = useSearch(filters, {
    enabled: !semantic || submittedQ !== "",
  });

  // Sport and position are filtered client-side in both modes so that changing
  // a pill in semantic mode costs nothing. filter/slice preserve order, which
  // keeps the backend's cosine ranking intact.
  const matching = useMemo(
    () => (position ? data.filter((p) => p.position === position) : data),
    [data, position],
  );
  const counts = useMemo(
    () => ({
      "": matching.length,
      basketball: matching.filter((p) => p.sport === "basketball").length,
      soccer: matching.filter((p) => p.sport === "soccer").length,
    }),
    [matching],
  );
  const results = sport ? matching.filter((p) => p.sport === sport) : matching;
  const pages = Math.ceil(results.length / PAGE);
  const slice = results.slice(page * PAGE, page * PAGE + PAGE);

  // A disabled react-query stays `pending` forever, so the idle state is keyed
  // off the submitted query, never off a loading flag.
  const idle = semantic && !submittedQ;
  const busy = !idle && (isLoading || (semantic && isFetching));

  const submit = (e) => {
    e.preventDefault();
    if (!semantic) return;
    setSubmittedQ(q.trim());
    setPage(0);
  };

  const changeMode = (next) => {
    setMode(next);
    setPage(0);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <form onSubmit={submit} className="mb-4">
        <div className="flex items-center gap-3 bg-white/5 border border-white/15 rounded px-3 transition-colors focus-within:border-accent">
          <Search size={16} className="shrink-0 text-white/40" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!semantic) setPage(0);
            }}
            placeholder={
              semantic
                ? "Describe a player — e.g. 'elite rim protector'"
                : "Search for a player"
            }
            aria-label="Search players"
            className="w-full bg-transparent py-3 outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="shrink-0 font-mono text-xs px-3 py-1 rounded-sm border border-white/15 text-white/60 transition-colors hover:border-accent hover:text-accent"
          >
            SEARCH
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 mb-2">
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

      <div className="flex flex-wrap items-center gap-2 mb-6">
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
        <div className="ml-auto">
          <SearchModeToggle mode={mode} onChange={changeMode} />
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {idle
          ? "Describe a player, then submit to search"
          : busy
            ? "Searching"
            : `${results.length} results`}
      </div>

      {idle ? (
        <div className="border border-white/10 bg-white/[0.02] rounded-sm p-10 text-center">
          <p className="font-mono text-xs text-accent mb-2">SMART SEARCH</p>
          <p className="text-sm text-white/60">
            Describe a playing style and press Enter — try “lockdown defender
            with elite passing”.
          </p>
        </div>
      ) : busy ? (
        <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PlayerCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="border border-white/10 bg-white/[0.02] rounded-sm p-10 text-center">
          <p className="font-mono text-xs text-white/40 mb-2">NO MATCHES</p>
          <p className="text-sm text-white/60">
            {semantic
              ? "No players matched that description. Try describing a playing style differently."
              : "No players matched that name."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
          {slice.map((p) => (
            <PlayerCard key={p.name} player={p} />
          ))}
        </div>
      )}

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
