import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import ParticleField from "../components/universe/ParticleField";
import Autocomplete from "../components/search/Autocomplete";
import FilterPill from "../components/ui/FilterPill";
import FeaturedCard from "../components/cards/FeaturedCard";
import { api } from "../api/client";

const FEATURED_NBA = ["Nikola Jokić", "Stephen Curry", "Giannis Antetokounmpo"];

function FeaturedStack() {
  const results = useQueries({
    queries: FEATURED_NBA.map((n) => ({ queryKey: ["player", n], queryFn: () => api.getPlayer(n) })),
  });
  const ready = results.filter((r) => r.data);
  return (
    <div className="absolute bottom-6 right-6 w-80 grid gap-3">
      {ready.map((r) => {
        const a = r.data.player, b = r.data.matches[0];
        return <FeaturedCard key={a.name} a={a} b={{ name: b.name, sport: b.sport }} similarity={b.similarity} />;
      })}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("all");
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6">
      <ParticleField />
      <h1 className="text-5xl font-bold mb-2">
        Find a player's <span className="text-accent">cross-sport twin</span>
      </h1>
      <p className="text-white/50 mb-8 font-mono text-sm">585 NBA &amp; soccer players · 7 universal attributes</p>
      <Autocomplete
        sportFilter={sport}
        onSelect={(name) => navigate(`/player/${encodeURIComponent(name)}`)}
      />
      <div className="flex gap-2 mt-4">
        {["all", "basketball", "soccer"].map((s) => (
          <FilterPill key={s} active={sport === s} onClick={() => setSport(s)}>
            {s === "all" ? "ALL" : s === "basketball" ? "NBA" : "SOCCER"}
          </FilterPill>
        ))}
      </div>
      <FeaturedStack />
    </div>
  );
}
