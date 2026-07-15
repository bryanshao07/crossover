import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { enc } from "../../lib/format";
import { useRemoveFavorite } from "../../hooks/useFavorites";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";
import DnaLabel from "../ui/DnaLabel";

export default function FavoriteCard({ favorite, player }) {
  const removeFavorite = useRemoveFavorite();

  function handleRemove(e) {
    e.preventDefault();
    e.stopPropagation();
    removeFavorite.mutate(favorite.id);
  }

  return (
    <Link
      to={`/player/${enc(favorite.player_name)}`}
      className="glass p-4 flex flex-col gap-3 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        {player ? <SportBadge sport={player.sport} /> : <span />}
        <button
          type="button"
          onClick={handleRemove}
          disabled={removeFavorite.isPending}
          aria-label="Remove favorite"
          className="text-accent transition-colors hover:text-white/80 disabled:opacity-50"
        >
          <Bookmark className="w-4 h-4" fill="currentColor" />
        </button>
      </div>

      <div className="flex items-center justify-center">
        <Avatar sport={player?.sport} src={player?.headshot_url} size={56} />
      </div>

      <div className="text-center">
        <div className="truncate text-sm font-medium" title={favorite.player_name}>
          {favorite.player_name}
        </div>
        {player?.dna && <DnaLabel dna={player.dna} className="mt-1 block text-xs truncate" />}
      </div>
    </Link>
  );
}
