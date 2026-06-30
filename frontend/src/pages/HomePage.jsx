import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Autocomplete from "../components/search/Autocomplete";
import FeaturedCard from "../components/cards/FeaturedCard";
import { usePlayers } from "../hooks/usePlayers";
import { api } from "../api/client";
import { useTransition } from "../context/TransitionContext";

const EASE = [0.4, 0, 0.2, 1];

const FEATURED_NBA = ["Nikola Jokić", "Stephen Curry", "Giannis Antetokounmpo"];

function FeaturedStack() {
  const results = useQueries({
    queries: FEATURED_NBA.map((n) => ({ queryKey: ["player", n], queryFn: () => api.getPlayer(n) })),
  });
  const ready = results.filter((r) => r.data);
  return (
    <div className="hidden lg:flex absolute z-10 bottom-6 right-6 gap-3">
      {ready.map((r) => {
        const a = r.data.player, b = r.data.matches[0];
        return <FeaturedCard key={a.name} a={a} b={{ name: b.name, sport: b.sport, headshot_url: b.headshot_url }} similarity={b.similarity} />;
      })}
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
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden flex flex-col items-center justify-start pt-[9vh] px-6">
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
        <p className="text-white/90 text-xl sm:text-2xl font-semibold mt-3 mb-8">
          Don&apos;t know soccer? Find your player.
        </p>

        <div className="relative z-30 w-full flex justify-center">
          <Autocomplete
            size="lg"
            leadingIcon
            kbd="⌘ K"
            sportFilter={sport}
            onSportChange={setSport}
            placeholder="Search any NBA or soccer player..."
            onSelect={(name) => navigate(`/player/${encodeURIComponent(name)}`)}
          />
        </div>

        <button
          onClick={() => startUniverseTransition(() => navigate("/universe", { state: { fromHome: true } }))}
          className="mt-8 flex flex-col items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors duration-200 group"
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

      {/* Absolute UI elements — fade out independently */}
      <motion.div
        animate={leaving ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0, ease: EASE }}
      >
        <Legend />
        <FeaturedStack />
      </motion.div>
    </div>
  );
}
