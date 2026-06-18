export default function FilterPill({ active, onClick, children, color }) {
  const base =
    "font-mono text-xs px-3 py-1 rounded-sm border transition-colors";

  // colored variant (used by homepage NBA/Soccer/All pills)
  if (color) {
    const style = active
      ? { backgroundColor: color, borderColor: color, color: "#0a0a0f" }
      : { borderColor: `${color}66`, color };
    return (
      <button
        onClick={onClick}
        style={style}
        className={`${base} font-semibold hover:brightness-110`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${base} ${
        active
          ? "border-accent text-accent bg-accent/10"
          : "border-white/15 text-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
