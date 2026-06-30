import { useEffect, useRef } from "react";

const NBA_COLOR = "#4a7fff";
const SOC_COLOR = "#39d353";
const ACCENT = "#e8ff47";

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2.5 7.5C2.5 4.74 4.74 2.5 7.5 2.5c1.38 0 2.63.53 3.56 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11.5 4.5l-.44-1.6-1.6.44" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 7.5c0 2.76-2.24 5-5 5-1.38 0-2.63-.53-3.56-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.5 10.5l.44 1.6 1.6-.44" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="5" y="1" width="5" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="7.5" y1="4" x2="7.5" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1v3M7.5 11v3M1 7.5h3M11 7.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 5.5h4v4h-4z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
      <line x1="7" y1="1" x2="7" y2="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="7" y1="11.5" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="1" y1="7" x2="2.5" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="11.5" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function ControlPanel({ query, setQuery, sport, setSport, colorBy, setColorBy, onResetZoom, data = [] }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const nbaCount = data.filter((p) => p.sport === "basketball").length;
  const socCount = data.filter((p) => p.sport === "soccer").length;

  return (
    <div
      className="absolute top-4 left-4 z-40 flex flex-col gap-7"
      style={{
        width: 280,
        background: "rgba(10,10,15,0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding: "22px 20px",
      }}
    >
      {/* Search */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          padding: "7px 10px",
          cursor: "text",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><SearchIcon /></span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Highlight a player..."
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontFamily: "Inter, sans-serif", fontSize: 12, color: "#fff",
            minWidth: 0,
          }}
        />
        <kbd style={{
          fontFamily: "Inter, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)",
          border: "1px solid rgba(255,255,255,0.15)", padding: "1px 5px",
          borderRadius: 3, flexShrink: 0, letterSpacing: "0.02em",
        }}>⌘ K</kbd>
      </div>

      {/* Filter by sport */}
      <div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 8 }}>
          FILTER BY SPORT
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { value: "all", label: "All" },
            { value: "basketball", label: "NBA" },
            { value: "soccer", label: "Soccer" },
          ].map(({ value, label }) => {
            const active = sport === value;
            const sportColor = value === "basketball" ? NBA_COLOR : value === "soccer" ? SOC_COLOR : null;
            return (
              <button
                key={value}
                onClick={() => setSport(value)}
                style={{
                  fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
                  padding: "4px 10px", cursor: "pointer", border: "1px solid",
                  borderColor: active
                    ? (sportColor ?? ACCENT)
                    : (sportColor ? `${sportColor}55` : "rgba(255,255,255,0.15)"),
                  background: active
                    ? (sportColor ?? ACCENT)
                    : "transparent",
                  color: active
                    ? (sportColor ? "#fff" : "#0a0a0f")
                    : (sportColor ?? "rgba(255,255,255,0.6)"),
                  transition: "all 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color by */}
      <div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 8 }}>
          COLOR BY
        </div>
        <div style={{ position: "relative" }}>
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value)}
            style={{
              width: "100%", appearance: "none", WebkitAppearance: "none",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 12,
              padding: "7px 32px 7px 10px", cursor: "pointer", outline: "none",
            }}
          >
            <option value="sport" style={{ background: "#0a0a0f" }}>Sport</option>
            <option value="accent" style={{ background: "#0a0a0f" }}>Dominant Attribute</option>
          </select>
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "rgba(255,255,255,0.4)" }}
          >
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* View controls */}
      <div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 8 }}>
          VIEW CONTROLS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: <RotateIcon />, label: "Rotate" },
            { icon: <ZoomIcon />, label: "Zoom" },
            { icon: <PanIcon />, label: "Pan" },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.5)" }}>
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12 }}>{label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onResetZoom}
          style={{
            marginTop: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, padding: "8px 0", cursor: "pointer",
            border: `1px solid ${ACCENT}`, background: "transparent",
            color: ACCENT, fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600,
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = `${ACCENT}18`}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <ResetIcon />
          Reset Zoom
        </button>
      </div>

      {/* Legend */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
        {[
          { color: NBA_COLOR, label: `NBA (${nbaCount} players)` },
          { color: SOC_COLOR, label: `Soccer (${socCount} players)` },
          { color: ACCENT, label: "Highlighted Player" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
