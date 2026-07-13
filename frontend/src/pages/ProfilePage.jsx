import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useComparisons, useDeleteComparison } from "../hooks/useComparisons";
import { useFavorites, useRemoveFavorite } from "../hooks/useFavorites";
import { pct, enc } from "../lib/format";

function EmptyState({ label }) {
  return <div className="text-sm text-white/40 py-6 text-center">{label}</div>;
}

function ComparisonRow({ comparison, onDelete }) {
  return (
    <div className="glass p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="truncate font-medium">{comparison.player_a}</span>
          <span className="text-white/30">×</span>
          <span className="truncate font-medium">{comparison.player_b}</span>
        </div>
        {comparison.similarity_score != null && (
          <div className="font-mono text-xs mt-1" style={{ color: "#e8ff47" }}>
            {pct(comparison.similarity_score)} similar
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to={`/compare/${enc(comparison.player_a)}/${enc(comparison.player_b)}`}
          className="font-mono text-xs text-accent hover:underline"
        >
          View →
        </Link>
        <button
          type="button"
          onClick={() => onDelete(comparison.id)}
          className="text-white/40 hover:text-red-400 transition-colors font-mono text-xs"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function FavoriteRow({ favorite, onDelete }) {
  return (
    <div className="glass p-4 flex items-center justify-between gap-4">
      <Link to={`/player/${enc(favorite.player_name)}`} className="truncate font-medium hover:text-accent">
        {favorite.player_name}
      </Link>
      <button
        type="button"
        onClick={() => onDelete(favorite.id)}
        className="text-white/40 hover:text-red-400 transition-colors font-mono text-xs shrink-0"
      >
        Remove
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { data: comparisons = [], isLoading: comparisonsLoading } = useComparisons();
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites();
  const deleteComparison = useDeleteComparison();
  const removeFavorite = useRemoveFavorite();

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
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center font-mono text-xl font-bold shrink-0"
          style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #4a7fff 100%)" }}
        >
          {user.email[0].toUpperCase()}
        </div>
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
        {comparisonsLoading ? (
          <EmptyState label="Loading…" />
        ) : comparisons.length === 0 ? (
          <EmptyState label="No saved comparisons yet." />
        ) : (
          <div className="grid gap-3">
            {comparisons.map((c) => (
              <ComparisonRow key={c.id} comparison={c} onDelete={(id) => deleteComparison.mutate(id)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-wider mb-3">Favorites</h2>
        {favoritesLoading ? (
          <EmptyState label="Loading…" />
        ) : favorites.length === 0 ? (
          <EmptyState label="No favorites yet." />
        ) : (
          <div className="grid gap-3">
            {favorites.map((f) => (
              <FavoriteRow key={f.id} favorite={f} onDelete={(id) => removeFavorite.mutate(id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
