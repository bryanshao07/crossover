import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import Autocomplete from "../components/search/Autocomplete";
import FeaturedCard from "../components/cards/FeaturedCard";
import Skeleton from "../components/ui/Skeleton";
import { api } from "../api/client";
import { useTransition } from "../context/TransitionContext";
import { SPORT_OPTIONS } from "../lib/sports";

const EASE = [0.4, 0, 0.2, 1];

function SportPills({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      {SPORT_OPTIONS.map((s) => {
        const active = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className="font-mono text-xs tracking-wider uppercase px-3 py-1.5 border transition-colors duration-150"
            style={
              active
                ? { color: s.color, borderColor: s.color, backgroundColor: `${s.color}18` }
                : { color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.12)", backgroundColor: "transparent" }
            }
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

const FEATURED_NBA = [
  "Nikola Jokić",
  "Stephen Curry",
  "Giannis Antetokounmpo",
  "LeBron James",
  "Luka Dončić",
  "Joel Embiid",
  "Jayson Tatum",
  "Shai Gilgeous-Alexander",
  "Anthony Edwards",
  "Kevin Durant",
];

function FeaturedCardSkeleton() {
  return (
    <div className="glass px-3 py-2 w-44 flex flex-col items-center text-center">
      <div className="flex items-center justify-center gap-2 w-full">
        <Skeleton className="w-[22px] h-[22px] rounded-full" />
        <Skeleton className="w-2 h-2" />
        <Skeleton className="w-[22px] h-[22px] rounded-full" />
      </div>
      <div className="mt-1 flex items-start justify-center gap-2 w-full">
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 flex-1" />
      </div>
      <Skeleton className="mt-1.5 h-2 w-16" />
      <Skeleton className="mt-1 h-5 w-12" />
    </div>
  );
}

// Title panel that heads the band — replaces the old player-count legend.
function BandTitle() {
  return (
    <div className="shrink-0 flex flex-col justify-center gap-1 px-5 py-3 border-r border-white/10 w-[172px]">
      <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-accent/80">
        Cross-Sport
      </span>
      <span className="text-white/90 text-lg font-semibold leading-tight">
        Top Comparisons
      </span>
    </div>
  );
}

// "See more" tile that lives at the end of the scrollable row, revealed once
// you scroll the comparisons to the end. Same footprint as a FeaturedCard.
function SeeMoreCard() {
  return (
    <Link
      to="/compare"
      className="shrink-0 w-44 glass flex flex-col items-center justify-center gap-2 text-center border-accent/40 hover:border-accent hover:bg-accent/10 transition-transform transition-colors duration-150 hover:scale-[1.02]"
    >
      <span className="font-mono text-[11px] font-semibold tracking-[0.18em] uppercase text-accent leading-snug">
        See more<br />comparisons
      </span>
      <span className="text-accent text-lg leading-none">→</span>
    </Link>
  );
}

// Chevron button that scrolls the comparison row. Dims (non-interactive) when
// there's nothing further to reveal in that direction.
function ScrollArrow({ direction, onClick, disabled }) {
  const right = direction === "right";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={right ? "Scroll comparisons right" : "Scroll comparisons left"}
      className={`shrink-0 flex items-center justify-center px-2 transition-colors ${
        right ? "border-l" : "border-r"
      } border-white/10 ${
        disabled ? "text-white/15 cursor-default" : "text-white/50 hover:text-accent hover:bg-white/5"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d={right ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// Centered, fixed band pinned to the bottom of the viewport: legend on the left,
// then a horizontally-scrollable row of top comparisons ending in a "See more"
// tile, flanked by arrow buttons that reveal more without bleeding off-screen.
function LowerBand() {
  const results = useQueries({
    queries: FEATURED_NBA.map((n) => ({ queryKey: ["player", n], queryFn: () => api.getPlayer(n) })),
  });
  const allSettled = results.every((r) => !r.isPending);
  const ready = results.filter((r) => r.data);

  const scrollRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
  }, [updateArrows, allSettled]);

  const scrollByPage = (dir) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // Fade each edge only when there's hidden content that way, so the cards
  // dissolve into motion as they scroll off — mirroring the arrow affordance.
  const fadeLeft = !atStart;
  const fadeRight = !atEnd;
  const leftStop = fadeLeft ? "transparent 0, #000 44px" : "#000 0";
  const rightStop = fadeRight ? "#000 calc(100% - 44px), transparent 100%" : "#000 100%";
  const maskImage = `linear-gradient(to right, ${leftStop}, ${rightStop})`;

  return (
    <div
      data-lower-band
      className="hidden md:flex absolute z-10 bottom-4 left-4 right-4 mx-auto max-w-6xl glass items-stretch overflow-hidden"
    >
      <BandTitle />
      <ScrollArrow direction="left" onClick={() => scrollByPage(-1)} disabled={atStart} />
      <div className="relative flex flex-1 min-w-0">
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          style={{ maskImage, WebkitMaskImage: maskImage }}
          className="lower-band-scroll flex-1 min-w-0 flex items-stretch gap-2.5 overflow-x-auto px-3 py-2"
        >
        {allSettled
          ? ready.map((r) => {
              const a = r.data.player, b = r.data.matches[0];
              return (
                <div key={a.name} className="shrink-0">
                  <FeaturedCard a={a} b={{ name: b.name, sport: b.sport, headshot_url: b.headshot_url }} similarity={b.similarity} />
                </div>
              );
            })
          : FEATURED_NBA.map((n) => (
              <div key={n} className="shrink-0">
                <FeaturedCardSkeleton />
              </div>
            ))}
        <SeeMoreCard />
        </div>
        {/* Blurred edges — strongest at the outer edge, fading inward — so cards
            appear to blur into motion as they scroll off. Shown only where there
            is hidden content that way. */}
        <div
          aria-hidden
          className={`lower-band-edge lower-band-edge-left transition-opacity duration-300 ${fadeLeft ? "opacity-100" : "opacity-0"}`}
        />
        <div
          aria-hidden
          className={`lower-band-edge lower-band-edge-right transition-opacity duration-300 ${fadeRight ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      <ScrollArrow direction="right" onClick={() => scrollByPage(1)} disabled={atEnd} />
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("all");
  const { universeMode, startUniverseTransition } = useTransition();
  const leaving = universeMode === "active";
  const reduceMotion = useReducedMotion();

  const exploreUniverse = useCallback(() => {
    startUniverseTransition(() => navigate("/universe", { state: { fromHome: true } }));
  }, [startUniverseTransition, navigate]);

  // Scrolling down anywhere on the homepage triggers the same universe
  // transition as the Explore button. There's no real scroll (the page is a
  // fixed viewport), so we listen for downward wheel / swipe intent instead.
  useEffect(() => {
    if (leaving) return;
    let acc = 0;
    let done = false;
    const insideInteractive = (e) =>
      !!e.target?.closest?.('[role="listbox"], [data-lower-band]');

    const onWheel = (e) => {
      if (done || insideInteractive(e)) return;
      if (e.deltaY <= 0) {
        acc = 0;
        return;
      }
      acc += e.deltaY;
      if (acc > 30) {
        done = true;
        exploreUniverse();
      }
    };

    let startY = null;
    const onTouchStart = (e) => {
      startY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e) => {
      if (done || startY == null || insideInteractive(e)) return;
      const delta = startY - (e.touches[0]?.clientY ?? startY);
      if (delta > 60) {
        done = true;
        exploreUniverse();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [leaving, exploreUniverse]);

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden flex flex-col items-center justify-start pt-[6vh] px-6">
      {/* Readability halo — darkens + softens the busy universe directly behind
          the hero text, fading smoothly to the clear background at the edges */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(58% 66% at 50% 44%, rgba(10,10,15,0.5) 0%, rgba(10,10,15,0.3) 42%, rgba(10,10,15,0) 74%)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          maskImage:
            "radial-gradient(58% 66% at 50% 44%, #000 38%, transparent 76%)",
          WebkitMaskImage:
            "radial-gradient(58% 66% at 50% 44%, #000 38%, transparent 76%)",
        }}
        animate={leaving ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.3, delay: 0, ease: EASE }}
      />

      {/* Foreground content — fades out and drifts up during Phase 1 */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        animate={leaving ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0, ease: EASE }}
      >
        <img src="/logo.png" alt="CrossOver" className="h-20 w-20 mb-2" />
        <h1 className="font-mono font-bold text-accent text-6xl sm:text-7xl tracking-tight leading-none">
          CrossOver
        </h1>
        <p className="text-white/90 text-xl sm:text-2xl font-semibold mt-3 mb-5">
          Don&apos;t know soccer? Find your player.
        </p>

        <SportPills value={sport} onChange={setSport} />

        <div className="relative z-30 w-full flex justify-center">
          <Autocomplete
            size="lg"
            leadingIcon
            kbd="⌘ K"
            sportFilter={sport}
            placeholder="Search any NBA or soccer player..."
            onSelect={(name) => navigate(`/player/${encodeURIComponent(name)}`)}
          />
        </div>

        {/* Single Explore control — the accent CTA and the scroll affordance
            are one button; clicking OR scrolling down both enter the universe */}
        <button
          onClick={exploreUniverse}
          className="group mt-5 flex flex-col items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0a0f]"
          aria-label="Explore the Universe — or scroll down"
        >
          <span className="flex items-center rounded-sm border border-accent bg-accent/10 px-7 py-3 text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-[#0a0a0f]">
            <span className="font-mono text-sm font-semibold tracking-widest uppercase">Explore Universe</span>
          </span>
          <span className="flex items-center gap-1.5 text-white/35 transition-colors duration-200 group-hover:text-white/70">
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase">Scroll</span>
            <motion.svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              animate={reduceMotion ? undefined : { y: [0, 3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="text-accent/80"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          </span>
        </button>
      </motion.div>

      {/* Absolute UI elements — fade out independently, staggered 100ms after foreground */}
      <motion.div
        animate={leaving ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: leaving ? 0.1 : 0, ease: EASE }}
      >
        <LowerBand />
      </motion.div>
    </div>
  );
}
