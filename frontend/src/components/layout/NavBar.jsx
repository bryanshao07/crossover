import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTransition } from "../../context/TransitionContext";

const navLinkClass = ({ isActive }) =>
  `hover:text-white pb-0.5 border-b-2 ${
    isActive ? "text-white border-accent" : "border-transparent"
  }`;

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { startUniverseTransition } = useTransition();

  const handleUniverseClick = (e) => {
    if (location.pathname === "/") {
      e.preventDefault();
      startUniverseTransition(() => navigate("/universe", { state: { fromHome: true } }));
    }
  };

  return (
    <nav className="flex items-center gap-3 px-6 h-16 border-b border-white/10 sticky top-0 z-50 bg-bg/80 backdrop-blur">
      <Link to="/" className="flex items-center gap-2">
        <img src="/logo.png" alt="CrossOver" className="h-12 w-auto" />
        <span className="font-bold text-accent text-lg">CrossOver</span>
      </Link>
      <div className="ml-auto flex items-center gap-5 text-sm text-white/70">
        <NavLink to="/universe" className={navLinkClass} onClick={handleUniverseClick}>Universe</NavLink>
        <NavLink to="/compare" className={navLinkClass}>Compare</NavLink>
        <NavLink to="/search" className={navLinkClass}>Search</NavLink>
      </div>
    </nav>
  );
}
