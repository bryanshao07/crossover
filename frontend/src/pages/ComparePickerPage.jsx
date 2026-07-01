import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import Autocomplete from "../components/search/Autocomplete";
import Skeleton from "../components/ui/Skeleton";
import { api } from "../api/client";
import { enc, pct } from "../lib/format";

const POPULAR_NBA = ["LeBron James", "Kevin Durant", "Stephen Curry"];

const HEX_CLIP = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

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
}) {
  return (
    <div
      className="flex-1 relative rounded flex flex-col"
      style={{ padding: "1px" }}
    >
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

  const containerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const [pathD, setPathD] = useState("");
  const geomRef = useRef({});
  const [vsOffset, setVsOffset] = useState(null);

  const recalcPath = useCallback(() => {
    const container = containerRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!container || !left || !right) return;

    const cb = container.getBoundingClientRect();
    const lb = left.getBoundingClientRect();
    const rb = right.getBoundingClientRect();

    const lx = lb.left - cb.left;
    const ly = lb.top - cb.top;
    const lw = lb.width;
    const lh = lb.height;
    const rx = rb.left - cb.left;
    const ry = rb.top - cb.top;
    const rw = rb.width;
    const rh = rb.height;

    // Connector attachment points: horizontal center of each panel's inner edge.
    const lrx = lx + lw; // NBA right edge x
    const lcy = ly + lh / 2; // NBA right-center y
    const rlx = rx; // Soccer left edge x
    const rcy = ry + rh / 2; // Soccer left-center y

    // Snapshot geometry so the vsOffset effect can measure the path.
    geomRef.current = { lw, lh, rw, rh, lrx, rlx };

    // Single closed loop — full perimeter of each panel before crossing the connector.
    // NBA perimeter clockwise from right-center (up right side → top → left → bottom
    // → back to right-center), then connector across to Soccer left-center, Soccer
    // perimeter clockwise (up left side → top → right → bottom → back to left-center),
    // then Z closes the return connector back to NBA right-center.
    setPathD(
      `M ${lrx},${lcy}` + // NBA right-center (connector junction, start)
        ` L ${lrx},${ly}` + // ↑ up right side → NBA top-right
        ` L ${lx},${ly}` + // ← left along top → NBA top-left
        ` L ${lx},${ly + lh}` + // ↓ down left side → NBA bottom-left
        ` L ${lrx},${ly + lh}` + // → right along bottom → NBA bottom-right
        ` L ${lrx},${lcy}` + // ↑ up right side → NBA right-center (perimeter done)
        ` L ${rlx},${rcy}` + // → connector → Soccer left-center
        ` L ${rlx},${ry}` + // ↑ up left side → Soccer top-left
        ` L ${rx + rw},${ry}` + // → right along top → Soccer top-right
        ` L ${rx + rw},${ry + rh}` + // ↓ down right side → Soccer bottom-right
        ` L ${rlx},${ry + rh}` + // ← left along bottom → Soccer bottom-left
        ` L ${rlx},${rcy}` + // ↑ up left side → Soccer left-center (perimeter done)
        ` Z`, // ← return connector → NBA right-center
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    recalcPath();
    const ro = new ResizeObserver(recalcPath);
    ro.observe(container);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    return () => ro.disconnect();
  }, [recalcPath]);

  useEffect(() => {
    if (!pathD) return;
    const { lw, lh, rw, rh, rlx, lrx } = geomRef.current;
    if (!lw) return;
    const tmp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tmp.setAttribute("d", pathD);
    const total = tmp.getTotalLength();
    if (!total) return;

    const connLen = rlx - lrx;

    // Particle 1 starts at NBA bottom-right, travels forward (clockwise).
    // From NBA bottom-right → up right side lh/2 → NBA right-center (VS-left).
    const nba_br = (1.6408 * lh + 2 * lw) / total;

    // Particle 2 starts at Soccer top-left, travels backward (counter-clockwise).
    // From Soccer top-left → down left side rh/2 → Soccer left-center (VS-right).
    const vs_right = (1 * lh + 2 * lw + connLen) / total;
    const soccer_tl = vs_right + (0.5 * rh) / total;

    setVsOffset({ nba_br, soccer_tl });
  }, [pathD]);

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
      <div
        ref={containerRef}
        className="mt-10 relative flex flex-col md:flex-row items-stretch gap-4"
      >
        {/* Unified circuit loop — one closed SVG path spanning both panels */}
        {pathD && vsOffset !== null && (
          <svg
            aria-hidden="true"
            className="hidden md:block absolute inset-0 pointer-events-none"
            style={{
              width: "100%",
              height: "100%",
              overflow: "visible",
              zIndex: 10,
            }}
          >
            <defs>
              <style>{`
                @keyframes circuit-line-a {
                  from { stroke-dashoffset: ${-vsOffset.nba_br}; }
                  to   { stroke-dashoffset: ${-(1 + vsOffset.nba_br)}; }
                }
                @keyframes circuit-line-b {
                  from { stroke-dashoffset: ${-vsOffset.soccer_tl}; }
                  to   { stroke-dashoffset: ${1 - vsOffset.soccer_tl}; }
                }
              `}</style>
              <filter id="cp-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="3"
                  result="blur"
                />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="cp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4a7fff" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#e8ff47" />
                <stop offset="100%" stopColor="#39d353" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {/* Line 1 — starts at path origin */}
            <path
              d={pathD}
              fill="none"
              stroke="url(#cp-grad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="0.05 0.95"
              strokeDashoffset="0"
              pathLength="1"
              filter="url(#cp-glow)"
              style={{ animation: "circuit-line-a 20s linear infinite" }}
            />
            {/* Line 2 — offset by half the loop so both meet at VS simultaneously */}
            <path
              d={pathD}
              fill="none"
              stroke="url(#cp-grad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="0.05 0.95"
              strokeDashoffset="0"
              pathLength="1"
              filter="url(#cp-glow)"
              style={{ animation: "circuit-line-b 20s linear infinite" }}
            />
          </svg>
        )}

        <div ref={leftRef} className="flex-1 flex flex-col">
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
        </div>

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
              <span className="font-mono font-bold text-accent text-lg">
                VS
              </span>
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

        <div ref={rightRef} className="flex-1 flex flex-col">
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
