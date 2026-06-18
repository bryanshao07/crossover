export default function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs px-3 py-1 rounded-sm border transition-colors ${
        active ? "border-accent text-accent bg-accent/10" : "border-white/15 text-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
