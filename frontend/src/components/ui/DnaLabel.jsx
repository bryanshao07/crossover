export default function DnaLabel({ dna, className = "" }) {
  return <span className={`text-accent text-sm ${className}`}>{dna}</span>;
}
