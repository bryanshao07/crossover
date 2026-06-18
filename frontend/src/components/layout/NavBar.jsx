import { Link } from "react-router-dom";

export default function NavBar() {
  return (
    <nav className="flex items-center gap-3 px-6 h-14 border-b border-white/10 sticky top-0 z-50 bg-bg/80 backdrop-blur">
      <Link to="/" className="flex items-center gap-2">
        <img src="/logo.png" alt="CrossOver" className="h-8 w-auto" />
        <span className="font-bold text-accent text-lg">CrossOver</span>
      </Link>
      <div className="ml-auto flex items-center gap-5 text-sm text-white/70">
        <Link to="/universe" className="hover:text-white">Universe</Link>
        <Link to="/search" className="hover:text-white">Search</Link>
      </div>
    </nav>
  );
}
