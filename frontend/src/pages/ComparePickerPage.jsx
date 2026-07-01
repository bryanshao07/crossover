import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import Autocomplete from "../components/search/Autocomplete";
import Skeleton from "../components/ui/Skeleton";
import { api } from "../api/client";
import { enc, pct } from "../lib/format";

const POPULAR_NBA = ["LeBron James", "Kevin Durant", "Stephen Curry"];

const HEX_CLIP =
  "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

// One side of the picker — a glass panel scoped to a single sport.
function PickerPanel({
  sport,
  label,
  color,
  placeholder,
  browseTo,
  selected,
  onSelect,
  onClear,
  reverse,
}) {
  // A brighter tint of each sport color for the rotating highlight peak
  const brightColor = color === "#4a7fff" ? "#a8c8ff" : "#7ff09a";

  return (
    <div
      className="flex-1 relative rounded flex flex-col"
      style={{ padding: "1px" }}
    >
      {/* Rotating border highlight — overflow:hidden clips the spinning gradient
          to the panel's bounding box; the inner panel's solid bg masks the
          interior, leaving only the 1px edge gap as the visible "border". */}
      <div className="absolute inset-0 rounded overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "300%",
            height: "300%",
            background: `conic-gradient(
              from 0deg,
              ${color}30 0%,
              ${color}30 78%,
              ${color}80 85%,
              ${brightColor} 91%,
              #ffffffaa 94%,
              ${brightColor} 97%,
              ${color}80 99%,
              ${color}30 100%
            )`,
            animation: `${reverse ? "rotateBorderCCW" : "rotateBorder"} 4s linear infinite`,
          }}
        />
      </div>

      {/* Inner panel — solid bg hides the gradient interior */}
      <div
        className="relative flex-1 p-5"
        style={{ background: "#0c0c13", borderRadius: "3px" }}
      >
        <div
          className="font-mono text-xs font-semibold tracking-wider mb-3"
          style={{ color }}
        >
          {label}
        </div>

        {selected ? (
          <div
            className="flex items-center gap-3 bg-black/80 border rounded px-4 py-3"
            style={{ borderColor: color }}
          >
            <span className="font-sans text-white truncate">{selected}</span>
            <button
              type="button"
              aria-label={`Clear ${label} selection`}
              onClick={onClear}
              className="ml-auto p-0.5 text-white/40 hover:text-white/90"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <Autocomplete
            sportFilter={sport}
            placeholder={placeholder}
            leadingIcon
            onSelect={onSelect}
          />
        )}

        <Link
          to={browseTo}
          className="inline-flex items-center gap-1.5 font-mono text-sm mt-4 hover:opacity-80"
          style={{ color }}
        >
          Browse players →
        </Link>
      </div>
    </div>
  );
}

// One popular-matchup card: an NBA player paired with their top cross-sport match.
function MatchupCard({ a, b, similarity }) {
  return (
    <Link
      to={`/compare/${enc(a)}/${enc(b)}`}
      className="glass p-4 flex flex-col hover:border-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between font-mono text-xs font-semibold tracking-wider">
        <span style={{ color: "#4a7fff" }}>NBA</span>
        <span style={{ color: "#39d353" }}>SOCCER</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-white/90">
        <span className="truncate">{a}</span>
        <span className="text-white/30 shrink-0">×</span>
        <span className="truncate text-right">{b}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono font-bold text-accent text-3xl">
          {pct(similarity)}
        </span>
        <span className="font-mono text-xs text-white/40 tracking-wider">
          SIMILAR
        </span>
      </div>
      <div className="mt-2 h-1 w-full bg-white/10 rounded-sm overflow-hidden">
        <div className="h-full bg-accent" style={{ width: pct(similarity) }} />
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 text-center font-mono text-sm text-accent">
        View comparison →
      </div>
    </Link>
  );
}

// Top cross-sport match for each featured NBA player, sourced live from the API.
function PopularMatchups() {
  const results = useQueries({
    queries: POPULAR_NBA.map((n) => ({
      queryKey: ["player", n],
      queryFn: () => api.getPlayer(n),
    })),
  });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {results.map((r, i) => {
        if (!r.data) return <Skeleton key={POPULAR_NBA[i]} className="h-44" />;
        const top = r.data.matches[0];
        return (
          <MatchupCard
            key={POPULAR_NBA[i]}
            a={r.data.player.name}
            b={top.name}
            similarity={top.similarity}
          />
        );
      })}
    </div>
  );
}

export default function ComparePickerPage() {
  const navigate = useNavigate();
  const [nba, setNba] = useState(null);
  const [soccer, setSoccer] = useState(null);
  const ready = Boolean(nba && soccer);

  function compare() {
    if (!ready) return;
    navigate(`/compare/${enc(nba)}/${enc(soccer)}`);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-mono font-bold text-white text-4xl sm:text-5xl text-center tracking-tight">
        COMPARE ANY PLAYERS
      </h1>

      {/* Two picker panels with a VS hexagon between them */}
      <div className="mt-10 flex flex-col md:flex-row items-stretch gap-4">
        <PickerPanel
          sport="basketball"
          label="NBA"
          color="#4a7fff"
          placeholder="Search NBA players..."
          browseTo="/search?sport=nba"
          selected={nba}
          onSelect={setNba}
          onClear={() => setNba(null)}
        />

        <div className="flex items-center justify-center shrink-0 py-2 md:py-0">
          {/* Left connector: NBA blue → VS accent */}
          <span
            className="hidden md:block h-0.5 w-8 -ml-4"
            style={{
              background: "linear-gradient(to right, #4a7fff, #e8ff47)",
            }}
          />
          <div
            className="flex items-center justify-center w-16 h-16"
            style={{ clipPath: HEX_CLIP, backgroundColor: "#e8ff47" }}
          >
            <div
              className="flex items-center justify-center w-[calc(100%-3px)] h-[calc(100%-3px)] bg-bg"
              style={{ clipPath: HEX_CLIP }}
            >
              <span className="font-mono font-bold text-accent text-lg">VS</span>
            </div>
          </div>
          {/* Right connector: VS accent → soccer green */}
          <span
            className="hidden md:block h-0.5 w-8 -mr-4"
            style={{
              background: "linear-gradient(to right, #e8ff47, #39d353)",
            }}
          />
        </div>

        <PickerPanel
          sport="soccer"
          label="SOCCER"
          color="#39d353"
          placeholder="Search soccer players..."
          browseTo="/search?sport=soccer"
          selected={soccer}
          onSelect={setSoccer}
          onClear={() => setSoccer(null)}
          reverse
        />
      </div>

      {/* Compare action */}
      <button
        type="button"
        onClick={compare}
        disabled={!ready}
        className={`glass w-full mt-6 py-5 flex items-center justify-center gap-3 font-mono font-bold tracking-wider transition-colors ${
          ready
            ? "border-accent text-accent hover:bg-accent/10 cursor-pointer"
            : "text-white/30 cursor-not-allowed"
        }`}
      >
        {ready ? (
          <>
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            COMPARE PLAYERS →
          </>
        ) : (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        {!ready && "Select one NBA player and one soccer player to continue."}
      </button>

      {/* Popular matchups */}
      <div className="mt-12">
        <div className="flex items-center gap-4">
          <span className="flex-1 h-px bg-white/10" />
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
            Popular Matchups
          </h2>
          <span className="flex-1 h-px bg-white/10" />
        </div>

        <div className="mt-6">
          <PopularMatchups />
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="font-mono text-xs text-white/50">
          Cross-sport comparisons use 7 core attributes to find true player
          similarities.
        </p>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="font-mono text-sm text-accent hover:opacity-80 cursor-pointer"
        >
          Learn more about our method →
        </a>
      </div>
    </div>
  );
}
