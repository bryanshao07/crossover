import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTransition } from "../../context/TransitionContext";
import { useAuth } from "../../context/AuthContext";
import { resolveAvatarUrl } from "../../lib/format";

const navLinkClass = ({ isActive }) =>
  `hover:text-white pb-0.5 border-b-2 ${
    isActive ? "text-white border-accent" : "border-transparent"
  }`;

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden font-mono text-xs font-bold shrink-0 transition-all ring-2 ring-white/40 hover:brightness-110"
        style={!user.avatar_url ? { background: "linear-gradient(180deg, #0a0a0f 0%, #4a7fff 100%)" } : undefined}
      >
        {user.avatar_url ? (
          <img src={resolveAvatarUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
        ) : (
          user.email[0].toUpperCase()
        )}
      </button>
      {open && (
        <div className="border border-accent bg-accent/10 backdrop-blur-md rounded absolute right-0 top-full mt-2 min-w-[120px] py-0.5 text-sm text-white/70 z-50">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-1 text-center hover:bg-white/10 hover:text-white"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="block w-full px-3 py-1 text-center hover:bg-white/10 hover:text-white"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { startUniverseTransition } = useTransition();
  const { user, loading, logout } = useAuth();

  const handleUniverseClick = (e) => {
    if (location.pathname === "/") {
      e.preventDefault();
      startUniverseTransition(() => navigate("/universe", { state: { fromHome: true } }));
    }
  };

  async function handleLogout() {
    await logout();
    navigate("/");
  }

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
        {!loading && (user ? (
          <UserMenu user={user} onLogout={handleLogout} />
        ) : (
          <Link
            to="/login"
            className="px-3 py-1 text-bg bg-accent hover:brightness-110 transition-all font-semibold"
            style={{ borderRadius: "2px" }}
          >
            Login
          </Link>
        ))}
      </div>
    </nav>
  );
}
