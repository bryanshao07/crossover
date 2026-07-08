import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Autocomplete from "../components/search/Autocomplete";
import FeaturedCard from "../components/cards/FeaturedCard";
import Skeleton from "../components/ui/Skeleton";
import { usePlayers } from "../hooks/usePlayers";
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

const FEATURED_NBA = ["Nikola Jokić", "Stephen Curry", "Giannis Antetokounmpo"];

function FeaturedCardSkeleton() {
  return (
    <div className="glass px-3 py-3 w-44 flex flex-col items-center text-center">
      <div className="flex items-center justify-center gap-2 w-full">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-2 h-2" />
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
      <div className="mt-1.5 flex items-start justify-center gap-2 w-full">
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 flex-1" />
      </div>
      <Skeleton className="mt-2 h-2 w-16" />
      <Skeleton className="mt-1 h-6 w-12" />
    </div>
  );
}

function FeaturedStack() {
  const results = useQueries({
    queries: FEATURED_NBA.map((n) => ({ queryKey: ["player", n], queryFn: () => api.getPlayer(n) })),
  });
  const allSettled = results.every((r) => !r.isPending);
  const ready = results.filter((r) => r.data);
  return (
    <div className="hidden lg:flex absolute z-10 bottom-6 right-6 gap-3">
      {allSettled
        ? ready.map((r) => {
            const a = r.data.player, b = r.data.matches[0];
            return <FeaturedCard key={a.name} a={a} b={{ name: b.name, sport: b.sport, headshot_url: b.headshot_url }} similarity={b.similarity} />;
          })
        : FEATURED_NBA.map((n) => <FeaturedCardSkeleton key={n} />)}
    </div>
  );
}

function Legend() {
  const { data: players = [] } = usePlayers();
  const nba = players.filter((p) => p.sport === "basketball").length;
  const soccer = players.filter((p) => p.sport === "soccer").length;
  return (
    <div className="hidden md:block absolute z-10 bottom-6 left-6 glass px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#4a7fff" }} />
        <span className="text-white/70">NBA</span>
        <span className="font-mono text-white/40">({nba} players)</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#39d353" }} />
        <span className="text-white/70">Soccer</span>
        <span className="font-mono text-white/40">({soccer} players)</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("all");
  const { universeMode, startUniverseTransition } = useTransition();
  const leaving = universeMode === "active";

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden flex flex-col items-center justify-start pt-[6vh] px-6">
      {/* Foreground content — fades out and drifts up during Phase 1 */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        animate={leaving ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0, ease: EASE }}
      >
        <img src="/logo.png" alt="CrossOver" className="h-24 w-24 mb-3" />
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

        <button
          onClick={() => startUniverseTransition(() => navigate("/universe", { state: { fromHome: true } }))}
          className="mt-6 flex flex-col items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors duration-200 group"
          aria-label="Explore the Universe"
        >
          <span className="font-mono text-xs tracking-widest uppercase">Explore Universe</span>
          <motion.svg
            width="20" height="20" viewBox="0 0 20 20" fill="none"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="text-accent opacity-70 group-hover:opacity-100 transition-opacity duration-200"
          >
            <path d="M10 4v12M4 10l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </button>
      </motion.div>

      {/* Absolute UI elements — fade out independently, staggered 100ms after foreground */}
      <motion.div
        animate={leaving ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: leaving ? 0.1 : 0, ease: EASE }}
      >
        <Legend />
        <FeaturedStack />
      </motion.div>
    </div>
  );
}
