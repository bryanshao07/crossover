const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const shimmerStyle = {
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 2s linear infinite",
};

export default function Skeleton({ className = "", style }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-sm ${reduceMotion ? "animate-pulse bg-white/5" : ""} ${className}`}
      style={reduceMotion ? style : { ...shimmerStyle, ...style }}
    />
  );
}
