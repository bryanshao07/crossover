import { Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFavorites, useAddFavorite, useRemoveFavorite } from "../../hooks/useFavorites";

export default function FavoriteButton({ playerName, className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: favorites = [] } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const existing = favorites.find((f) => f.player_name === playerName);
  const isFavorited = !!existing;
  const pending = addFavorite.isPending || removeFavorite.isPending;

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    if (isFavorited) {
      removeFavorite.mutate(existing.id);
    } else {
      addFavorite.mutate(playerName);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      className={`shrink-0 transition-colors disabled:opacity-50 ${
        isFavorited ? "text-accent" : "text-white/40 hover:text-white/80"
      } ${className}`}
    >
      <Bookmark className="w-4 h-4" fill={isFavorited ? "currentColor" : "none"} />
    </button>
  );
}
