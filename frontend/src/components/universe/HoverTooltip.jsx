import SportBadge from "../ui/SportBadge";

export default function HoverTooltip({ hovered, x, y }) {
  if (!hovered) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 glass px-3 py-2 text-sm"
      style={{ left: x + 12, top: y + 12 }}
    >
      <div className="flex items-center gap-2">
        {hovered.name}
        <SportBadge sport={hovered.sport} />
      </div>
      <div className="text-accent text-xs mt-1">{hovered.dna}</div>
    </div>
  );
}
