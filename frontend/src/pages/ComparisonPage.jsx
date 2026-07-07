import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useCompare } from "../hooks/useCompare";
import { useExplain } from "../hooks/useExplain";
import { useDelayedLoading } from "../hooks/useDelayedLoading";
import OverlapRadarChart from "../components/charts/OverlapRadarChart";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import PlayerCardSkeleton, { CenterColumnSkeleton } from "../components/ui/PlayerCardSkeleton";
import { pct, enc } from "../lib/format";
import { ATTRIBUTES, SPORT_COLOR } from "../lib/attributes";
import { ATTRIBUTE_ICONS } from "../lib/attributeIcons";

function AttributeScores({ player }) {
  const sportColor = SPORT_COLOR[player.sport];
  return (
    <div className="mt-5">
      <h3 className="font-mono text-[10px] text-white/40 uppercase tracking-wider mb-3">
        Attribute Scores
      </h3>
      <div className="grid gap-2.5">
        {ATTRIBUTES.map(({ key, displayLabel: label }) => {
          const score = Math.round((player[key] ?? 0) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-white/40 shrink-0">{ATTRIBUTE_ICONS[key]}</span>
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
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={`/player/${enc(player.name)}`}
      className="block h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="p-5 flex flex-col h-full transition-all duration-150 bg-white/5 backdrop-blur-md rounded"
        style={{
          border: `1px solid ${hovered ? "rgba(232,255,71,0.55)" : "rgba(255,255,255,0.1)"}`,
          boxShadow: hovered ? "0 0 18px 0 rgba(232,255,71,0.1)" : "none",
        }}
      >
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
    </Link>
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

function ExplainModal({ playerA, playerB, onClose, explain }) {
  const whyBullets = explain.data?.bullets?.slice(0, 3) ?? [];
  const keyBullets = explain.data?.bullets?.slice(3) ?? [];
  const isLoading = explain.isLoading;
  const hasData = !!explain.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl glass p-6"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider" style={{ color: "#e8ff47" }}>
            {playerA} × {playerB}
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/90 transition-colors p-0.5"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* WHY THEY MATCH */}
        <div className="mb-5">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-white/60">
            Why They Match
          </h3>
          {isLoading && (
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          )}
          {hasData && whyBullets.length > 0 && (
            <ul className="space-y-2.5">
              {whyBullets.map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/80 leading-snug">
                  <span className="text-white/30 shrink-0 mt-0.5">•</span>
                  <span dangerouslySetInnerHTML={{ __html: formatBullet(bullet) }} />
                </li>
              ))}
            </ul>
          )}
          {explain.isError && (
            <div className="text-xs text-white/40">Could not load explanation.</div>
          )}
        </div>

        {/* KEY DIFFERENCE */}
        {(isLoading || (hasData && keyBullets.length > 0)) && (
          <>
            <div className="w-full h-px bg-white/10 mb-5" />
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-white/60">
                Key Difference
              </h3>
              {isLoading && (
                <div className="grid gap-2">
                  {[0, 1].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              )}
              {hasData && keyBullets.length > 0 && (
                <ul className="space-y-2.5">
                  {keyBullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/80 leading-snug">
                      <span className="text-white/30 shrink-0 mt-0.5">•</span>
                      <span dangerouslySetInnerHTML={{ __html: formatBullet(bullet) }} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const { a, b } = useParams();
  const an = decodeURIComponent(a);
  const bn = decodeURIComponent(b);
  const { data, isLoading, isError } = useCompare(an, bn);
  const showSkeleton = useDelayedLoading(isLoading);
  const [modalOpen, setModalOpen] = useState(false);
  const [explainOn, setExplainOn] = useState(false);
  const explain = useExplain(an, bn, { enabled: explainOn });

  function openExplain() {
    setExplainOn(true);
    setModalOpen(true);
  }

  if (showSkeleton) {
    return (
      <div className="max-w-7xl mx-auto p-6 grid gap-4">
        <div className="grid md:grid-cols-[5fr_6fr_5fr] gap-4 items-start">
          <PlayerCardSkeleton />
          <CenterColumnSkeleton />
          <PlayerCardSkeleton />
        </div>
        <div className="glass p-5" />
      </div>
    );
  }
  if (isLoading) return null;

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

      {/* Explanation modal */}
      {modalOpen && (
        <ExplainModal
          playerA={player_a.name}
          playerB={player_b.name}
          onClose={() => setModalOpen(false)}
          explain={explain}
        />
      )}

      {/* Navigation buttons */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          to={`/player/${enc(player_b.name)}`}
          className="flex items-center justify-center gap-2 font-mono text-sm py-3 px-6 border border-accent text-accent hover:bg-accent/10 transition-colors text-center"
          style={{ borderRadius: "2px" }}
        >
          Find matches for {player_b.name} →
        </Link>
        <button
          type="button"
          onClick={openExplain}
          className="flex items-center justify-center gap-2 font-mono text-sm py-3 px-6 border border-accent text-accent hover:bg-accent/10 transition-colors"
          style={{ borderRadius: "2px" }}
        >
          Generate explanation
        </button>
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
