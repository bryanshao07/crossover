export default function GlassPanel({ className = "", children }) {
  return <div className={`glass ${className}`}>{children}</div>;
}
