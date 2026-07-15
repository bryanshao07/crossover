import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { pct, enc } from "../../lib/format";
import { useDeleteComparison } from "../../hooks/useComparisons";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";

export default function SavedComparisonCard({ comparison, playerA, playerB }) {
  const deleteComparison = useDeleteComparison();

  function handleRemove(e) {
    e.preventDefault();
    e.stopPropagation();
    deleteComparison.mutate(comparison.id);
  }

  return (
    <Link
      to={`/compare/${enc(playerA.name)}/${enc(playerB.name)}`}
      className="glass p-4 flex flex-col gap-3 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <SportBadge sport={playerA.sport} />
        <div className="flex items-center gap-2">
          <SportBadge sport={playerB.sport} />
          <button
            type="button"
            onClick={handleRemove}
            disabled={deleteComparison.isPending}
            aria-label="Remove saved comparison"
            className="text-accent transition-colors hover:text-white/80 disabled:opacity-50"
          >
            <Bookmark className="w-4 h-4" fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Avatar sport={playerA.sport} src={playerA.headshot_url} size={56} />
        <span className="text-white/30 text-sm">×</span>
        <Avatar sport={playerB.sport} src={playerB.headshot_url} size={56} />
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="flex-1 min-w-0 truncate text-center" title={playerA.name}>
          {playerA.name}
        </span>
        <span className="flex-1 min-w-0 truncate text-center" title={playerB.name}>
          {playerB.name}
        </span>
      </div>

      {comparison.similarity_score != null && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-accent">
              {pct(comparison.similarity_score)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
              Similar
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-sm bg-white/10">
            <div
              className="h-full rounded-sm bg-accent"
              style={{ width: `${comparison.similarity_score * 100}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}
