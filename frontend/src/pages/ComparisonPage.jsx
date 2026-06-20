import { useParams } from "react-router-dom";
import { useState } from "react";
import { useCompare } from "../hooks/useCompare";
import { useExplain } from "../hooks/useExplain";
import OverlapRadarChart from "../components/charts/OverlapRadarChart";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { pct } from "../lib/format";

function Column({ p }) {
  return (
    <div className="glass p-5 flex-1">
      <div className="flex items-center gap-3">
        <Avatar sport={p.sport} src={p.headshot_url} size={48} />
        <div>
          <div className="font-bold">{p.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <SportBadge sport={p.sport} />
            <span className="font-mono text-xs text-white/50">{p.position}</span>
          </div>
        </div>
      </div>
      <DnaLabel dna={p.dna} className="block mt-3 text-xs" />
    </div>
  );
}

export default function ComparisonPage() {
  const { a, b } = useParams();
  const an = decodeURIComponent(a);
  const bn = decodeURIComponent(b);
  const { data, isLoading, isError } = useCompare(an, bn);
  const [explainOn, setExplainOn] = useState(false);
  const explain = useExplain(an, bn, { enabled: explainOn });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 grid gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-32 flex-1" />
          <Skeleton className="h-32 w-40 mx-auto" />
          <Skeleton className="h-32 flex-1" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (isError || !data) {
    return <div className="p-8 text-white/60">Comparison unavailable.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Top row: two player columns + central similarity score */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <Column p={data.player_a} />
        <div className="flex flex-col items-center justify-center px-4 py-4">
          <div className="font-mono text-4xl text-accent">{pct(data.similarity)}</div>
          <div className="font-mono text-xs text-white/40 mt-1">SIMILAR</div>
          {data.context && (
            <div className="text-xs text-white/50 text-center mt-2 max-w-[12rem] leading-relaxed">
              {data.context}
            </div>
          )}
        </div>
        <Column p={data.player_b} />
      </div>

      {/* Overlapping radar chart */}
      <div className="glass p-5 mt-6">
        <div className="flex items-center gap-4 mb-3">
          <span className="font-mono text-xs uppercase text-white/50">Attribute Comparison</span>
          <span className="flex items-center gap-1 text-xs font-mono" style={{ color: "#4a7fff" }}>
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "#4a7fff" }} />
            {data.player_a.name}
          </span>
          <span className="flex items-center gap-1 text-xs font-mono" style={{ color: "#39d353" }}>
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "#39d353" }} />
            {data.player_b.name}
          </span>
        </div>
        <OverlapRadarChart a={data.player_a} b={data.player_b} />
      </div>

      {/* Gemini explanation section */}
      <div className="glass p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs uppercase text-white/50">Why they match</h2>
          {!explainOn && (
            <button
              onClick={() => setExplainOn(true)}
              className="font-mono text-xs px-3 py-1 rounded-sm border border-accent text-accent hover:bg-accent/10 transition-colors"
            >
              Generate explanation
            </button>
          )}
        </div>

        {/* Skeleton rows while Gemini is loading */}
        {explainOn && explain.isLoading && (
          <div className="grid gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        )}

        {/* Rendered bullets */}
        {explain.data && (
          <ul className="list-disc pl-5 space-y-1 text-sm text-white/80">
            {explain.data.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        )}

        {/* Error state */}
        {explainOn && explain.isError && (
          <div className="text-xs text-white/40">Could not load explanation.</div>
        )}
      </div>
    </div>
  );
}
