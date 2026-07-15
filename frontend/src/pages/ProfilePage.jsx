import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useComparisons } from "../hooks/useComparisons";
import { useFavorites } from "../hooks/useFavorites";
import { useSearch } from "../hooks/useSearch";
import { resolveAvatarUrl } from "../lib/format";
import AvatarPickerModal from "../components/profile/AvatarPickerModal";
import SavedComparisonCard from "../components/cards/SavedComparisonCard";
import FavoriteCard from "../components/cards/FavoriteCard";

function EmptyState({ label }) {
  return <div className="text-sm text-white/40 py-6 text-center">{label}</div>;
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { data: comparisons = [], isLoading: comparisonsLoading } = useComparisons();
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites();
  const { data: players = [], isLoading: playersLoading } = useSearch({});
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const playersByName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);

  if (loading) {
    return <div className="max-w-4xl mx-auto p-8 text-center text-white/40">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <p className="text-white/60 mb-4">Log in to view your profile.</p>
        <Link to="/login" className="text-accent font-mono hover:underline">Log in →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <section className="glass p-6 flex items-center gap-6">
        <button
          type="button"
          onClick={() => setAvatarModalOpen(true)}
          aria-label="Change profile picture"
          className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden font-mono text-xl font-bold shrink-0 transition-all hover:ring-2 hover:ring-white/50"
          style={!user.avatar_url ? { background: "linear-gradient(180deg, #0a0a0f 0%, #4a7fff 100%)" } : undefined}
        >
          {user.avatar_url ? (
            <img src={resolveAvatarUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
          ) : (
            user.email[0].toUpperCase()
          )}
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{user.email}</h1>
          <p className="text-sm text-white/50">My CrossOver profile</p>
        </div>
        <div className="ml-auto flex gap-6 shrink-0">
          <div className="text-center">
            <div className="font-mono text-2xl font-bold" style={{ color: "#e8ff47" }}>{comparisons.length}</div>
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">Comparisons</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold" style={{ color: "#e8ff47" }}>{favorites.length}</div>
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">Favorites</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-wider mb-3">Saved Comparisons</h2>
        {comparisonsLoading || playersLoading ? (
          <EmptyState label="Loading…" />
        ) : comparisons.length === 0 ? (
          <EmptyState label="No saved comparisons yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparisons.map((c) => (
              <SavedComparisonCard
                key={c.id}
                comparison={c}
                playerA={playersByName.get(c.player_a)}
                playerB={playersByName.get(c.player_b)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-wider mb-3">Favorites</h2>
        {favoritesLoading || playersLoading ? (
          <EmptyState label="Loading…" />
        ) : favorites.length === 0 ? (
          <EmptyState label="No favorites yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((f) => (
              <FavoriteCard key={f.id} favorite={f} player={playersByName.get(f.player_name)} />
            ))}
          </div>
        )}
      </section>

      {avatarModalOpen && <AvatarPickerModal onClose={() => setAvatarModalOpen(false)} />}
    </div>
  );
}
