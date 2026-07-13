import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function friendlyError(err, fallback) {
  return err.response?.data?.detail || fallback;
}

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password);
      }
      navigate("/");
    } catch (err) {
      const status = err.response?.status;
      if (mode === "login" && status === 401) {
        setError("Invalid email or password.");
      } else if (mode === "signup" && status === 400) {
        setError(friendlyError(err, "Email already registered."));
      } else {
        setError(friendlyError(err, "Something went wrong. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8">
        <div className="flex border-b border-white/10 mb-6">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 pb-3 font-mono text-sm tracking-wider uppercase border-b-2 transition-colors ${
              mode === "login" ? "text-white border-accent" : "text-white/40 border-transparent hover:text-white/70"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 pb-3 font-mono text-sm tracking-wider uppercase border-b-2 transition-colors ${
              mode === "signup" ? "text-white border-accent" : "text-white/40 border-transparent hover:text-white/70"
            }`}
          >
            Sign Up
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-1">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-white/50 mb-6">
          {mode === "login" ? "Log in to continue your crossover journey." : "Start comparing across sports."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">Email</span>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full bg-white/5 border border-white/15 pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/60"
                style={{ borderRadius: "2px" }}
                autoComplete="email"
              />
            </div>
          </label>

          <label className="block">
            <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">Password</span>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-white/5 border border-white/15 pl-9 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/60"
                style={{ borderRadius: "2px" }}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          {error && <div className="text-xs text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 py-3 font-mono text-sm font-bold uppercase tracking-wider text-bg bg-accent hover:brightness-110 transition-all disabled:opacity-50"
            style={{ borderRadius: "2px" }}
          >
            {submitting ? "Please wait…" : mode === "login" ? "Log In →" : "Sign Up →"}
          </button>
        </form>

        <p className="text-center text-sm text-white/50 mt-6">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="text-accent font-semibold hover:underline"
          >
            {mode === "login" ? "Sign up →" : "Log in →"}
          </button>
        </p>
      </div>
    </div>
  );
}
