import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useCompare } from "../hooks/useCompare";
import { useExplain } from "../hooks/useExplain";
import OverlapRadarChart from "../components/charts/OverlapRadarChart";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { pct, enc } from "../lib/format";
import { SPORT_COLOR } from "../lib/attributes";

const ATTR_ROWS = [
  {
    key: "scoring",
    label: "SCORING",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    key: "playmaking",
    label: "PLAYMAKING",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M4 12a8 8 0 0 1 8-8" strokeLinecap="round" />
        <path d="M20 12a8 8 0 0 1-8 8" strokeLinecap="round" />
        <path d="M9 4l3-3 3 3M15 20l-3 3-3-3" />
      </svg>
    ),
  },
  {
    key: "defensive_impact",
    label: "DEFENSIVE IMPACT",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M12 3L4 7v6c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7l-8-4z" />
      </svg>
    ),
  },
  {
    key: "efficiency",
    label: "EFFICIENCY",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "versatility",
    label: "VERSATILITY",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 12h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "physical_dominance",
    label: "PHYSICAL DOMINANCE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M6 4h2v4H6zM16 4h2v4h-2zM4 6h16M8 8h8v8H8zM6 16h2v4H6zM16 16h2v4h-2zM4 18h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "durability",
    label: "DURABILITY",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
];

function AttributeScores({ player }) {
  const sportColor = SPORT_COLOR[player.sport];
  return (
    <div className="mt-5">
      <h3 className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-3">
        Attribute Scores
      </h3>
      <div className="grid gap-2.5">
        {ATTR_ROWS.map(({ key, label, icon }) => {
          const score = Math.round((player[key] ?? 0) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-white/40 shrink-0">{icon}</span>
              <span
                className="font-mono text-[10px] text-white/50 uppercase shrink-0"
                style={{ width: "8.5rem" }}
              >
                {label}
              </span>
              <div className="flex-1 h-[3px] rounded-full bg-white/10">
                <div
                  className="h-[3px] rounded-full transition-all"
                  style={{ width: `${score}%`, backgroundColor: sportColor }}
                />
              </div>
              <span
                className="font-mono text-base font-bold shrink-0 text-right"
                style={{ color: "#e8ff47", width: "2.25rem" }}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerColumn({ player }) {
  return (
    <div className="glass p-5 flex flex-col h-full">
      <div className="flex items-center gap-3">
        <Avatar sport={player.sport} src={player.headshot_url} size={72} />
        <div>
          <h2 className="text-xl font-bold leading-tight">{player.name}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <SportBadge sport={player.sport} />
            <span className="font-mono text-xs text-white/50">{player.position}</span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-1.5">DNA</div>
        <DnaLabel dna={player.dna} />
      </div>
      <AttributeScores player={player} />
    </div>
  );
}

const STAT_HIGHLIGHT = `color:#e8ff47;font-family:monospace;font-weight:700`;

function formatBullet(text) {
  return text.replace(
    /\*\*([^*]+)\*\*|(\([^)]*\d[^)]*\))/g,
    (match, bold, paren) =>
      `<strong style="${STAT_HIGHLIGHT}">${bold ?? paren}</strong>`
  );
}

function ExplainSection({ playerA, playerB, explainOn, setExplainOn, explain }) {
  const whyBullets = explain.data?.bullets?.slice(0, 3) ?? [];
  const keyBullets = explain.data?.bullets?.slice(3) ?? [];

  const isLoading = explainOn && explain.isLoading;
  const hasData = !!explain.data;

  return (
    <div className="glass p-5">
      <div className="flex flex-col md:flex-row gap-6">
        {/* WHY THEY MATCH */}
        <div className="flex-[2]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: "#e8ff47" }}>
              Why They Match
            </h2>
            {!explainOn && (
              <button
                onClick={() => setExplainOn(true)}
                className="font-mono text-xs px-3 py-1 border border-accent text-accent hover:bg-accent/10 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                Generate explanation
              </button>
            )}
          </div>
          {isLoading && (
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          )}
          {hasData && whyBullets.length > 0 && (
            <ul className="space-y-2">
              {whyBullets.map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/80 leading-snug">
                  <span className="text-white/30 shrink-0 mt-0.5">•</span>
                  <span dangerouslySetInnerHTML={{ __html: formatBullet(bullet) }} />
                </li>
              ))}
            </ul>
          )}
          {explainOn && explain.isError && (
            <div className="text-xs text-white/40">Could not load explanation.</div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-white/10 shrink-0" />

        {/* KEY DIFFERENCE */}
        <div className="flex-1">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#e8ff47" }}>
            Key Difference
          </h2>
          {isLoading && (
            <div className="grid gap-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          )}
          {hasData && keyBullets.length > 0 && (
            <ul className="space-y-2">
              {keyBullets.map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/80 leading-snug">
                  <span className="text-white/30 shrink-0 mt-0.5">•</span>
                  <span dangerouslySetInnerHTML={{ __html: formatBullet(bullet) }} />
                </li>
              ))}
            </ul>
          )}
          {hasData && keyBullets.length === 0 && !isLoading && whyBullets.length === 0 && (
            <div className="text-xs text-white/30 italic">Generate explanation to see differences.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const { a, b } = useParams();
  const an = decodeURIComponent(a);
  const bn = decodeURIComponent(b);
  const { data, isLoading, isError } = useCompare(an, bn);
  const [explainOn, setExplainOn] = useState(true);
  const explain = useExplain(an, bn, { enabled: explainOn });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 grid gap-4">
        <div className="grid md:grid-cols-[5fr_6fr_5fr] gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError || !data) {
    return <div className="p-8 text-white/60">Comparison unavailable.</div>;
  }

  const { player_a, player_b, similarity, context } = data;
  const sportLabelA = player_a.sport === "basketball" ? "NBA" : "Soccer";
  const sportLabelB = player_b.sport === "basketball" ? "NBA" : "Soccer";

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-4">
      {/* 3-column main layout */}
      <div className="grid md:grid-cols-[5fr_6fr_5fr] gap-4 items-start">
        {/* Left: Player A */}
        <PlayerColumn player={player_a} />

        {/* Center: Similarity + Radar */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <div
              className="font-mono font-black leading-none"
              style={{ fontSize: "clamp(3.5rem, 8vw, 5.5rem)", color: "#e8ff47" }}
            >
              {pct(similarity)}
            </div>
            <div className="font-mono font-bold text-xl tracking-widest mt-1" style={{ color: "#e8ff47" }}>
              SIMILAR
            </div>
            {context && (
              <div className="font-mono text-xs text-white/40 mt-2 leading-relaxed">
                {context}
              </div>
            )}
          </div>

          <div className="glass p-4 w-full">
            <OverlapRadarChart a={player_a} b={player_b} />
            <div className="flex justify-center gap-6 mt-3">
              <span
                className="flex items-center gap-1.5 font-mono text-xs"
                style={{ color: SPORT_COLOR[player_a.sport] }}
              >
                <span
                  className="inline-block w-4 h-0.5 rounded"
                  style={{ background: SPORT_COLOR[player_a.sport] }}
                />
                {player_a.name} ({sportLabelA})
              </span>
              <span
                className="flex items-center gap-1.5 font-mono text-xs"
                style={{ color: SPORT_COLOR[player_b.sport] }}
              >
                <span
                  className="inline-block w-4 h-0.5 rounded"
                  style={{ background: SPORT_COLOR[player_b.sport] }}
                />
                {player_b.name} ({sportLabelB})
              </span>
            </div>
          </div>
        </div>

        {/* Right: Player B */}
        <PlayerColumn player={player_b} />
      </div>

      {/* Bottom: Explanation */}
      <ExplainSection
        playerA={player_a}
        playerB={player_b}
        explainOn={explainOn}
        setExplainOn={setExplainOn}
        explain={explain}
      />

      {/* Navigation buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to={`/player/${enc(player_b.name)}`}
          className="flex items-center justify-center gap-2 font-mono text-sm py-3 px-6 border border-accent text-accent hover:bg-accent/10 transition-colors text-center"
          style={{ borderRadius: "2px" }}
        >
          Find matches for {player_b.name} →
        </Link>
        <Link
          to={`/player/${enc(player_a.name)}`}
          className="flex items-center justify-center gap-2 font-mono text-sm py-3 px-6 border border-accent text-accent hover:bg-accent/10 transition-colors text-center"
          style={{ borderRadius: "2px" }}
        >
          Find matches for {player_a.name} →
        </Link>
      </div>
    </div>
  );
}
