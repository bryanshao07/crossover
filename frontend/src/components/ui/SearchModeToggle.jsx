import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const MODES = [
  { key: "keyword", label: "NAME" },
  { key: "semantic", label: "SMART" },
];
const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

// Compact segmented control that lives inside the search bar. The accent fill
// is a single shared-layout element, so framer-motion slides it between the two
// segments instead of popping. Implements the ARIA radiogroup pattern: roving
// tabindex + arrow-key navigation.
export default function SearchModeToggle({ mode, onChange }) {
  const refs = useRef([]);
  const reduceMotion = useReducedMotion();

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
      className="relative shrink-0 inline-flex items-center gap-0.5 rounded-sm border border-white/15 bg-black/40 p-0.5"
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
            className={`relative px-2.5 py-1 font-mono text-[10px] tracking-wider rounded-sm transition-colors ${
              active ? "text-bg" : "text-white/50 hover:text-white/80"
            }`}
          >
            {active && (
              <motion.span
                layoutId="search-mode-indicator"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : // Deliberately gentle: fast springs finish in ~100ms,
                      // which reads as a pop rather than a slide.
                      { type: "spring", stiffness: 200, damping: 26, mass: 1.1 }
                }
                className="absolute inset-0 rounded-sm bg-accent"
              />
            )}
            <span className="relative z-10">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
