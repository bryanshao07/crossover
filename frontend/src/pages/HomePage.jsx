import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import ParticleField from "../components/universe/ParticleField";
import Autocomplete from "../components/search/Autocomplete";
import FilterPill from "../components/ui/FilterPill";
import FeaturedCard from "../components/cards/FeaturedCard";
import { usePlayers } from "../hooks/usePlayers";
import { api } from "../api/client";

const FEATURED_NBA = ["Nikola Jokić", "Stephen Curry", "Giannis Antetokounmpo"];

const SPORTS = [
  { key: "all", label: "All Players", color: "#e8ff47" },
  { key: "basketball", label: "NBA", color: "#4a7fff" },
  { key: "soccer", label: "Soccer", color: "#39d353" },
];

function FeaturedStack() {
  const results = useQueries({
    queries: FEATURED_NBA.map((n) => ({ queryKey: ["player", n], queryFn: () => api.getPlayer(n) })),
  });
  const ready = results.filter((r) => r.data);
  return (
    <div className="hidden lg:flex absolute z-10 bottom-6 right-6 gap-3">
      {ready.map((r) => {
        const a = r.data.player, b = r.data.matches[0];
        return <FeaturedCard key={a.name} a={a} b={{ name: b.name, sport: b.sport }} similarity={b.similarity} />;
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
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6">
      <ParticleField />

      <img src="/logo.png" alt="CrossOver" className="relative z-10 h-24 w-24 mb-3" />
      <h1 className="relative z-10 font-mono font-bold text-accent text-6xl sm:text-7xl tracking-tight leading-none">
        CrossOver
      </h1>
      <p className="relative z-10 text-white/90 text-xl sm:text-2xl font-semibold mt-3 mb-8">
        Don&apos;t know soccer? Find your player.
      </p>

      <div className="relative z-10 w-full flex justify-center">
        <Autocomplete
          sportFilter={sport}
          size="lg"
          leadingIcon
          kbd="⌘ K"
          placeholder="Search any NBA or soccer player..."
          onSelect={(name) => navigate(`/player/${encodeURIComponent(name)}`)}
        />
      </div>

      <div className="relative z-10 flex gap-2 mt-5">
        {SPORTS.map((s) => (
          <FilterPill key={s.key} active={sport === s.key} color={s.color} onClick={() => setSport(s.key)}>
            {s.label}
          </FilterPill>
        ))}
      </div>

      <Legend />
      <FeaturedStack />
    </div>
  );
}
