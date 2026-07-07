import { useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../api/client";
import { ATTRIBUTES, SPORT_COLOR, SPORT_LABEL } from "../../lib/attributes";
import { ATTRIBUTE_ICONS } from "../../lib/attributeIcons";
import { pct } from "../../lib/format";
import Avatar from "../ui/Avatar";

export default function PlayerPopup({ playerName, onClose }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["player", playerName],
    queryFn: () => api.getPlayer(playerName),
    enabled: !!playerName,
    placeholderData: keepPreviousData,
  });
  const noData = !data;

  const player = data?.player;
  const sportColor = player ? SPORT_COLOR[player.sport] : "#4a7fff";
  const sportLabel = player ? SPORT_LABEL[player.sport] : "";

  return (
    <div
      className="absolute right-20 top-8 w-80 pointer-events-auto overflow-hidden"
      style={{
        zIndex: 100000,
        background: "rgba(10,10,15,0.92)",
        border: `1px solid ${sportColor}55`,
        boxShadow: `0 0 12px 1px ${sportColor}28, inset 0 0 8px 0px ${sportColor}0d`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        maxHeight: "calc(100% - 2.5rem)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-3 pb-2 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {noData ? (
            <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
          ) : (
            <Avatar sport={player?.sport} src={player?.headshot_url} size={48} />
          )}
          <div className="min-w-0">
            {noData ? (
              <div className="h-6 w-40 bg-white/10 rounded animate-pulse mb-2" />
            ) : (
              <h2 className="text-lg font-bold text-white leading-tight truncate">{player?.name}</h2>
            )}
            <div className="flex items-center gap-2 mt-1">
              {noData ? (
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
              ) : (
                <>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sportColor }}
                  />
                  <span className="text-sm text-white/70 font-mono">
                    {sportLabel} · {player?.position}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors mt-0.5 flex-shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* DNA */}
      <div className="px-3 pb-2 h-[44px] flex flex-col justify-center">
        {noData ? (
          <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
        ) : (
          <>
            <p className="text-[10px] text-white/40 font-mono tracking-widest mb-1">DNA</p>
            <p className="text-xs font-mono font-semibold truncate" style={{ color: "#e8ff47" }}>
              {player?.dna}
            </p>
          </>
        )}
      </div>

      <div className="h-px mx-4 bg-white/10" />

      {/* Attribute bars */}
      <div className="px-3 py-2">
        <p className="text-[10px] text-white/40 font-mono tracking-widest mb-2">
          ATTRIBUTE PROFILE (PERCENTILE)
        </p>
        {noData
          ? ATTRIBUTES.map((a) => (
              <div key={a.key} className="flex items-center gap-2 mb-1.5">
                <div className="w-4 h-4 bg-white/10 rounded animate-pulse" />
                <div className="flex-1 h-3 bg-white/10 rounded animate-pulse" />
                <div className="w-6 h-3 bg-white/10 rounded animate-pulse" />
              </div>
            ))
          : ATTRIBUTES.map((a) => {
              const val = player?.[a.key] ?? 0;
              const pctValue = Math.round(val * 100);
              return (
                <div key={a.key} className="flex items-center gap-2 mb-1.5">
                  <span className="text-white/50 flex-shrink-0">{ATTRIBUTE_ICONS[a.key]}</span>
                  <span className="text-white/70 text-xs font-mono w-[118px] flex-shrink-0">
                    {a.displayLabel}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{ width: `${pctValue}%`, backgroundColor: sportColor }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono font-bold w-6 text-right flex-shrink-0"
                    style={{ color: sportColor }}
                  >
                    {pctValue}
                  </span>
                </div>
              );
            })}
      </div>

      {/* Top Matches */}
      <div className="h-px mx-3 bg-white/10" />
      <div className="px-3 pt-2 pb-2">
        <p className="text-[10px] text-white/40 font-mono tracking-widest mb-1.5">TOP MATCHES</p>
        <div className="overflow-y-auto max-h-[120px] flex flex-col gap-0.5 pr-1"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.15) transparent",
          }}>
          {noData
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1">
                  <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                  <div className="flex-1 h-3 bg-white/10 rounded animate-pulse" />
                  <div className="w-8 h-3 bg-white/10 rounded animate-pulse" />
                </div>
              ))
            : (data?.matches ?? []).slice(0, 5).map((m) => (
                <button
                  key={m.name}
                  onClick={() => navigate(`/compare/${encodeURIComponent(playerName)}/${encodeURIComponent(m.name)}`)}
                  className="flex items-center gap-2.5 py-1 px-1 w-full text-left hover:bg-white/5 transition-colors rounded-sm"
                >
                  <Avatar sport={m.sport} src={m.headshot_url} size={32} />
                  <span className="flex-1 text-xs font-mono text-white/80 truncate">{m.name}</span>
                  <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: sportColor }}>
                    {pct(m.similarity)}
                  </span>
                </button>
              ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="px-3 pb-3 flex flex-col gap-2">
        <button
          onClick={() => navigate(`/player/${encodeURIComponent(playerName)}`)}
          className="w-full py-2 text-sm font-mono font-semibold tracking-wide transition-colors"
          style={{
            border: "1px solid #e8ff47",
            color: "#e8ff47",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e8ff47";
            e.currentTarget.style.color = "#0a0a0f";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#e8ff47";
          }}
        >
          View Profile →
        </button>
        <button
          onClick={() => navigate(`/compare?a=${encodeURIComponent(playerName)}`)}
          className="w-full py-2.5 text-sm font-mono font-semibold tracking-wide text-white/80 hover:text-white transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.15)", background: "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
          }}
        >
          Compare →
        </button>
      </div>
    </div>
  );
}
