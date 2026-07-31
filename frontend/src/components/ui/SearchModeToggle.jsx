import { useRef } from "react";

const MODES = [
  { key: "keyword", label: "KEYWORD" },
  { key: "semantic", label: "SMART" },
];
const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

// Segmented control for choosing between substring keyword search and
// natural-language semantic search. Implements the ARIA radiogroup pattern:
// roving tabindex + arrow-key navigation.
export default function SearchModeToggle({ mode, onChange }) {
  const refs = useRef([]);

  const handleKeyDown = (e) => {
    if (!ARROWS.includes(e.key)) return;
    e.preventDefault();
    const i = MODES.findIndex((m) => m.key === mode);
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    const next = (i + (back ? MODES.length - 1 : 1)) % MODES.length;
    onChange(MODES[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Search mode"
      onKeyDown={handleKeyDown}
      className="inline-flex items-center gap-1 rounded-sm border border-white/15 bg-white/5 p-1"
    >
      {MODES.map((m, i) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(m.key)}
            className={`font-mono text-xs px-3 py-1 rounded-sm transition-colors ${
              active
                ? "bg-accent text-bg font-semibold"
                : "text-white/60 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
