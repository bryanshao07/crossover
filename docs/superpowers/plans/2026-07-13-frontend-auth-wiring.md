# Frontend Auth Wiring (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing React frontend up to the already-built, already-tested FastAPI auth backend (JWT via httpOnly cookies) — auth context, login/signup page, save-comparison button, favorite toggle, profile page, nav updates. No backend changes.

**Architecture:** A single `AuthContext` backed by React Query's `['auth','me']` query is the source of truth for the logged-in user; `login`/`signup`/`logout` mutate that query's cache directly via `queryClient.setQueryData`. Two new hook files (`useComparisons`, `useFavorites`) follow the codebase's existing one-liner React Query wrapper pattern (see `src/hooks/useCompare.js`). All new UI is hand-built with the same ad hoc Tailwind classes and `.glass` panel convention already used everywhere else in this codebase — no shadcn/ui (see decision note below), no new state management library.

**Tech Stack:** React 19, Vite 8, plain JS/JSX (no TypeScript), `@tanstack/react-query` 5, `axios` 1.18, `react-router-dom` 7, Tailwind 3.4. New dependency: `lucide-react` (icons only).

## Decision Notes (context for whoever reads this plan later)

- **Why no shadcn/ui, despite CLAUDE.md naming it in the tech stack:** it was never actually installed in phases 1-3 (no `components.json`, no Radix/cva/tailwind-merge deps). A real install was prototyped and rejected: the current `shadcn@latest` major (v4) is Tailwind-v4-only and fails to build against this project's Tailwind v3.4 config; the last Tailwind-v3-compatible version (`shadcn@2.10.0`) builds, but its generated `tailwind.config.js` overwrites the project's own `accent` color (`#e8ff47`, used everywhere via `text-accent`/`border-accent`/`bg-accent/10`) with shadcn's unrelated semantic `accent`/`accent-foreground` hover-state tokens, and its default border radius (`rounded-md`/`rounded-lg`, ~6-8px) violates CLAUDE.md's "2-4px max, sharp edges" rule. Reconciling all of that in every generated file was judged not worth it — hand-building matches the existing codebase convention exactly (see `Avatar.jsx`, `FilterPill.jsx`, `SportBadge.jsx` — all hand-rolled, no wrapper library) and has zero risk of regressing existing pages.
- **Why `lucide-react` as a real dependency:** it was already sitting in `node_modules` (via `package-lock.json`) but undeclared in `package.json` — a latent inconsistency. This plan declares it properly via `npm install` rather than relying on an undeclared transitive package.
- **Why no automated tests in this plan:** this repo has no test runner configured (no vitest/jest/testing-library in `package.json` devDependencies). Adding one is out of scope for a "wire the frontend to an existing, already-tested backend" task. Each task's verification step is `npm run build` (catches compile/syntax errors) plus a manual browser check — not a red/green test cycle.

## Global Constraints

- Do not modify any file under `backend/` or `notebook/`.
- Do not change existing player comparison/universe/search logic beyond the additive integration points listed in each task.
- Every `fetch`/axios call to a protected endpoint (`/auth/me`, `/auth/logout`, `/comparisons*`, `/favorites*`) must use `withCredentials: true` — the backend auth cookie (`access_token`) is httpOnly and won't be sent cross-origin otherwise.
- No TypeScript — this is a plain JS/JSX codebase (`.jsx` files, no type annotations, no `tsconfig.json`).
- No new state management library — use the existing `@tanstack/react-query` + React Context combination.
- New UI must use plain Tailwind utility classes matching existing conventions: `.glass` for panels, `text-accent`/`border-accent`/`bg-accent/10` for the brand yellow-green, `style={{ borderRadius: "2px" }}` or the `rounded`/`rounded-sm`/`rounded-md` utilities (mapped to 3px/2px/4px respectively per `tailwind.config.js`) for sharp edges, JetBrains Mono via the existing `font-mono`/`font-sans` classes (both map to JetBrains Mono already).
- Backend contracts (verbatim from `backend/routers/auth.py`, `backend/routers/comparisons.py`, `backend/routers/favorites.py` — do not re-derive, these are exact):

```python
# auth.py
class AuthRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str

# POST /auth/signup  body: AuthRequest        -> 201 UserResponse           | 400 if email taken (no cookie set)
# POST /auth/login   body: AuthRequest        -> 200 UserResponse           | 401 on bad credentials (sets access_token cookie)
# POST /auth/logout  (no body)                -> 200 {"detail": "Logged out"} (clears cookie)
# GET  /auth/me       (cookie required)       -> 200 UserResponse           | 401 {"detail": "Not authenticated"}

# comparisons.py
class ComparisonCreate(BaseModel):
    player_a: str
    player_b: str
    similarity_score: Optional[float] = None

class SavedComparisonResponse(BaseModel):
    id: int
    player_a: str
    player_b: str
    similarity_score: Optional[float]
    created_at: datetime

# POST   /comparisons              body: ComparisonCreate -> 201 SavedComparisonResponse
# GET    /comparisons              -> 200 List[SavedComparisonResponse] (desc by created_at, scoped to user)
# DELETE /comparisons/{id}         -> 204 | 404 if not found/not owned

# favorites.py
class FavoriteCreate(BaseModel):
    player_name: str

class FavoriteResponse(BaseModel):
    id: int
    player_name: str
    created_at: datetime

# POST   /favorites                body: {"player_name": str} -> 201 FavoriteResponse | 409 if already favorited
# GET    /favorites                -> 200 List[FavoriteResponse] (desc by created_at)
# DELETE /favorites/{id}           -> 204 | 404 if not found/not owned  (id is the FAVORITE's id, not looked up by player_name)
```

---

### Task 1: API client — credentials + auth/comparisons/favorites methods

**Files:**
- Modify: `frontend/package.json` (add `lucide-react`)
- Modify: `frontend/src/api/client.js`

**Interfaces:**
- Produces: `api.signup(email, password)`, `api.login(email, password)`, `api.logout()`, `api.getMe()`, `api.getComparisons()`, `api.createComparison(player_a, player_b, similarity_score)`, `api.deleteComparison(id)`, `api.getFavorites()`, `api.createFavorite(playerName)`, `api.deleteFavorite(id)` — all used by later tasks.

- [ ] **Step 1: Install lucide-react**

Run: `cd frontend && npm install lucide-react`
Expected: `package.json` dependencies gain `"lucide-react": "^1.24.0"` (or whatever the current published version resolves to), `package-lock.json` updates, exit code 0.

- [ ] **Step 2: Add `withCredentials` and new methods to the API client**

Replace the full contents of `frontend/src/api/client.js` with:

```js
import axios from "axios";
import { enc } from "../lib/format";

const base = import.meta.env.VITE_API_BASE_URL || "/api";
const http = axios.create({ baseURL: base, withCredentials: true });

export const api = {
  getPlayers: () => http.get("/players").then((r) => r.data),
  getPlayer: (name) => http.get(`/player/${enc(name)}`).then((r) => r.data),
  compare: (a, b) => http.get(`/compare/${enc(a)}/${enc(b)}`).then((r) => r.data),
  getUniverse: () => http.get("/universe").then((r) => r.data),
  explain: (a, b) => http.get(`/explain/${enc(a)}/${enc(b)}`).then((r) => r.data),
  search: ({ q, sport, position }) =>
    http
      .get("/search", { params: { q: q || undefined, sport: sport || undefined, position: position || undefined } })
      .then((r) => r.data),

  signup: (email, password) => http.post("/auth/signup", { email, password }).then((r) => r.data),
  login: (email, password) => http.post("/auth/login", { email, password }).then((r) => r.data),
  logout: () => http.post("/auth/logout").then((r) => r.data),
  getMe: () => http.get("/auth/me").then((r) => r.data),

  getComparisons: () => http.get("/comparisons").then((r) => r.data),
  createComparison: (player_a, player_b, similarity_score) =>
    http.post("/comparisons", { player_a, player_b, similarity_score }).then((r) => r.data),
  deleteComparison: (id) => http.delete(`/comparisons/${id}`),

  getFavorites: () => http.get("/favorites").then((r) => r.data),
  createFavorite: (playerName) => http.post("/favorites", { player_name: playerName }).then((r) => r.data),
  deleteFavorite: (id) => http.delete(`/favorites/${id}`),
};
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api/client.js
git commit -m "Add lucide-react and auth/comparisons/favorites API methods"
```

---

### Task 2: AuthContext + useAuth hook

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/main.jsx`

**Interfaces:**
- Consumes: `api.getMe`, `api.login`, `api.signup`, `api.logout` from Task 1.
- Produces: `AuthProvider` component; `useAuth()` hook returning `{ user: {id, email} | null, loading: boolean, login(email, password), signup(email, password), logout() }`. `login`/`signup`/`logout` all return Promises and throw on failure (axios error, inspect `err.response?.status`/`err.response?.data?.detail`).

- [ ] **Step 1: Create the AuthContext**

Create `frontend/src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.getMe(),
    retry: false,
    staleTime: Infinity,
  });

  async function login(email, password) {
    const me = await api.login(email, password);
    queryClient.setQueryData(["auth", "me"], me);
    return me;
  }

  async function signup(email, password) {
    await api.signup(email, password);
    return login(email, password);
  }

  async function logout() {
    await api.logout();
    queryClient.setQueryData(["auth", "me"], null);
    queryClient.removeQueries({ queryKey: ["comparisons"] });
    queryClient.removeQueries({ queryKey: ["favorites"] });
  }

  const value = { user: user ?? null, loading: isLoading, login, signup, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: Wrap the app in AuthProvider**

In `frontend/src/main.jsx`, add the import and wrap `<App />`:

```diff
 import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
 import App from "./App";
+import { AuthProvider } from "./context/AuthContext";
 import { TransitionProvider } from "./context/TransitionContext";
 import { UniverseProvider } from "./context/UniverseContext";
 import "./index.css";
```

```diff
     <QueryClientProvider client={queryClient}>
       <BrowserRouter>
-        <UniverseProvider>
-          <TransitionProvider>
-            <App />
-          </TransitionProvider>
-        </UniverseProvider>
+        <AuthProvider>
+          <UniverseProvider>
+            <TransitionProvider>
+              <App />
+            </TransitionProvider>
+          </UniverseProvider>
+        </AuthProvider>
       </BrowserRouter>
     </QueryClientProvider>
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/main.jsx
git commit -m "Add AuthContext backed by React Query auth/me cache"
```

---

### Task 3: Login/Signup page

**Files:**
- Create: `frontend/src/pages/AuthPage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `useAuth()` (`login`, `signup`) from Task 2.
- Produces: route `/login` rendering `<AuthPage />`.

- [ ] **Step 1: Create the AuthPage**

Create `frontend/src/pages/AuthPage.jsx`:

```jsx
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
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.jsx`:

```diff
 import PlayerProfilePage from "./pages/PlayerProfilePage";
 import ComparisonPage from "./pages/ComparisonPage";
 import ComparePickerPage from "./pages/ComparePickerPage";
 import UniversePage from "./pages/UniversePage";
 import SearchResultsPage from "./pages/SearchResultsPage";
+import AuthPage from "./pages/AuthPage";
```

```diff
         <Route path="/search" element={<SearchResultsPage />} />
+        <Route path="/login" element={<AuthPage />} />
       </Routes>
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 4: Manual check**

Run: `cd frontend && npm run dev` (with the backend also running per `backend/`'s own run instructions, on port 8000)
Navigate to `http://localhost:5173/login`. Confirm:
- Tabs toggle between Log In / Sign Up.
- Submitting empty fields shows "Email and password are required."
- Signing up with a new email redirects to `/`.
- Signing up with an already-used email shows the backend's 400 message.
- Logging in with wrong credentials shows "Invalid email or password."

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AuthPage.jsx frontend/src/App.jsx
git commit -m "Add login/signup page"
```

---

### Task 4: Nav bar auth state

**Files:**
- Modify: `frontend/src/components/layout/NavBar.jsx`

**Interfaces:**
- Consumes: `useAuth()` (`user`, `loading`, `logout`) from Task 2.

- [ ] **Step 1: Update NavBar**

Replace the full contents of `frontend/src/components/layout/NavBar.jsx` with:

```jsx
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTransition } from "../../context/TransitionContext";
import { useAuth } from "../../context/AuthContext";

const navLinkClass = ({ isActive }) =>
  `hover:text-white pb-0.5 border-b-2 ${
    isActive ? "text-white border-accent" : "border-transparent"
  }`;

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
          <>
            <NavLink to="/profile" className={navLinkClass}>{user.email}</NavLink>
            <button type="button" onClick={handleLogout} className="hover:text-white">Log out</button>
          </>
        ) : (
          <Link to="/login" className="hover:text-white">Log in / Sign up</Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 3: Manual check**

With `npm run dev` running, confirm: logged out shows "Log in / Sign up" linking to `/login`; after logging in, nav shows the user's email (linking to `/profile`, added in Task 8) and "Log out"; clicking "Log out" returns to logged-out nav state and redirects to `/`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/NavBar.jsx
git commit -m "Show auth state in nav bar"
```

---

### Task 5: useComparisons and useFavorites hooks

**Files:**
- Create: `frontend/src/hooks/useComparisons.js`
- Create: `frontend/src/hooks/useFavorites.js`

**Interfaces:**
- Consumes: `api.getComparisons/createComparison/deleteComparison`, `api.getFavorites/createFavorite/deleteFavorite` from Task 1; `useAuth()` from Task 2.
- Produces: `useComparisons()`, `useSaveComparison()`, `useDeleteComparison()`, `useFavorites()`, `useAddFavorite()`, `useRemoveFavorite()` — all used by Tasks 6, 7, 8.

- [ ] **Step 1: Create useComparisons**

Create `frontend/src/hooks/useComparisons.js`:

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export const useComparisons = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["comparisons"],
    queryFn: () => api.getComparisons(),
    enabled: !!user,
  });
};

export const useSaveComparison = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ player_a, player_b, similarity_score }) =>
      api.createComparison(player_a, player_b, similarity_score),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comparisons"] }),
  });
};

export const useDeleteComparison = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deleteComparison(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comparisons"] }),
  });
};
```

- [ ] **Step 2: Create useFavorites**

Create `frontend/src/hooks/useFavorites.js`:

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export const useFavorites = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites"],
    queryFn: () => api.getFavorites(),
    enabled: !!user,
  });
};

export const useAddFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playerName) => api.createFavorite(playerName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
    onError: (err) => {
      // 409 means it's already favorited (unique constraint) — treat as success, just resync.
      if (err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["favorites"] });
      }
    },
  });
};

export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.deleteFavorite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
};
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useComparisons.js frontend/src/hooks/useFavorites.js
git commit -m "Add useComparisons and useFavorites hooks"
```

---

### Task 6: Save Comparison button

**Files:**
- Modify: `frontend/src/pages/ComparisonPage.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 2), `useSaveComparison()` (Task 5).

- [ ] **Step 1: Add imports**

In `frontend/src/pages/ComparisonPage.jsx`, update the top imports:

```diff
-import { useParams, Link } from "react-router-dom";
+import { useParams, Link, useNavigate } from "react-router-dom";
 import { useState } from "react";
 import { useCompare } from "../hooks/useCompare";
 import { useExplain } from "../hooks/useExplain";
+import { useSaveComparison } from "../hooks/useComparisons";
+import { useAuth } from "../context/AuthContext";
 import { useDelayedLoading } from "../hooks/useDelayedLoading";
 import OverlapRadarChart from "../components/charts/OverlapRadarChart";
 import SportBadge from "../components/ui/SportBadge";
 import DnaLabel from "../components/ui/DnaLabel";
 import Avatar from "../components/ui/Avatar";
 import Skeleton from "../components/ui/Skeleton";
 import PlayerCardSkeleton, { CenterColumnSkeleton } from "../components/ui/PlayerCardSkeleton";
+import { Bookmark, Check } from "lucide-react";
 import { pct, enc } from "../lib/format";
 import { ATTRIBUTES, SPORT_COLOR } from "../lib/attributes";
 import { ATTRIBUTE_ICONS } from "../lib/attributeIcons";
```

- [ ] **Step 2: Add the SaveComparisonButton component**

Add this new component in `frontend/src/pages/ComparisonPage.jsx`, directly above `export default function ComparisonPage()`:

```jsx
function SaveComparisonButton({ playerA, playerB, similarity }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const saveComparison = useSaveComparison();
  const [justSaved, setJustSaved] = useState(false);

  function handleClick() {
    if (!user) {
      navigate("/login");
      return;
    }
    saveComparison.mutate(
      { player_a: playerA, player_b: playerB, similarity_score: similarity },
      {
        onSuccess: () => {
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
        },
      }
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saveComparison.isPending}
      className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider py-2 px-4 border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
      style={{ borderRadius: "2px" }}
    >
      {justSaved ? (
        <>
          <Check className="w-3.5 h-3.5" /> Saved
        </>
      ) : (
        <>
          <Bookmark className="w-3.5 h-3.5" /> {user ? "Save comparison" : "Log in to save"}
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Render it in the center column**

In the `ComparisonPage` component, insert the button between the similarity/context block and the radar chart glass panel:

```diff
             {context && (
               <div className="font-mono text-xs text-white/40 mt-2 leading-relaxed">
                 {context}
               </div>
             )}
           </div>

+          <SaveComparisonButton playerA={player_a.name} playerB={player_b.name} similarity={similarity} />
+
           <div className="glass p-4 w-full">
             <OverlapRadarChart a={player_a} b={player_b} />
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 5: Manual check**

With `npm run dev` running, visit any `/compare/:a/:b` page. Logged out: button reads "Log in to save" and clicking it navigates to `/login`. Logged in: clicking "Save comparison" shows a "Saved" checkmark for ~2 seconds, then reverts; confirm the row appears via `GET /comparisons` (checked fully in Task 8's profile page).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ComparisonPage.jsx
git commit -m "Add save comparison button to comparison page"
```

---

### Task 7: Favorite/bookmark toggle on player cards

**Files:**
- Create: `frontend/src/components/ui/FavoriteButton.jsx`
- Modify: `frontend/src/components/cards/PlayerCard.jsx`
- Modify: `frontend/src/components/cards/MatchCard.jsx`
- Modify: `frontend/src/components/universe/PlayerPopup.jsx`
- Modify: `frontend/src/pages/PlayerProfilePage.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 2), `useFavorites()`/`useAddFavorite()`/`useRemoveFavorite()` (Task 5).
- Produces: `<FavoriteButton playerName={string} className={string?} />`.

- [ ] **Step 1: Create FavoriteButton**

Create `frontend/src/components/ui/FavoriteButton.jsx`:

```jsx
import { Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFavorites, useAddFavorite, useRemoveFavorite } from "../../hooks/useFavorites";

export default function FavoriteButton({ playerName, className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: favorites = [] } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const existing = favorites.find((f) => f.player_name === playerName);
  const isFavorited = !!existing;
  const pending = addFavorite.isPending || removeFavorite.isPending;

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    if (isFavorited) {
      removeFavorite.mutate(existing.id);
    } else {
      addFavorite.mutate(playerName);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      className={`shrink-0 transition-colors disabled:opacity-50 ${
        isFavorited ? "text-accent" : "text-white/40 hover:text-white/80"
      } ${className}`}
    >
      <Bookmark className="w-4 h-4" fill={isFavorited ? "currentColor" : "none"} />
    </button>
  );
}
```

- [ ] **Step 2: Add to PlayerCard**

In `frontend/src/components/cards/PlayerCard.jsx`:

```diff
 import { Link } from "react-router-dom";
 import Avatar from "../ui/Avatar";
 import SportBadge from "../ui/SportBadge";
 import DnaLabel from "../ui/DnaLabel";
+import FavoriteButton from "../ui/FavoriteButton";
 import { SPORT_COLOR } from "../../lib/attributes";
```

```diff
   return (
-    <div className="glass flex flex-col overflow-hidden p-4 transition-colors hover:border-accent/50">
+    <div className="glass relative flex flex-col overflow-hidden p-4 transition-colors hover:border-accent/50">
+      <FavoriteButton playerName={player.name} className="absolute top-3 right-3 z-10" />
       <div className="flex gap-4">
```

- [ ] **Step 3: Add to MatchCard**

In `frontend/src/components/cards/MatchCard.jsx`:

```diff
 import { Link } from "react-router-dom";
 import { pct } from "../../lib/format";
 import Avatar from "../ui/Avatar";
 import SportBadge from "../ui/SportBadge";
 import DnaLabel from "../ui/DnaLabel";
+import FavoriteButton from "../ui/FavoriteButton";
```

```diff
         <DnaLabel dna={match.dna} className="text-xs truncate block" />
       </div>
+      <FavoriteButton playerName={match.name} />
       <span className="shrink-0 font-mono text-accent text-lg">{pct(match.similarity)}</span>
     </Link>
```

- [ ] **Step 4: Add to PlayerPopup (Universe)**

In `frontend/src/components/universe/PlayerPopup.jsx`:

```diff
 import { useNavigate } from "react-router-dom";
 import { useQuery, keepPreviousData } from "@tanstack/react-query";
 import { api } from "../../api/client";
 import { ATTRIBUTES, SPORT_COLOR, SPORT_LABEL } from "../../lib/attributes";
 import { ATTRIBUTE_ICONS } from "../../lib/attributeIcons";
 import { pct } from "../../lib/format";
 import Avatar from "../ui/Avatar";
+import FavoriteButton from "../ui/FavoriteButton";
```

```diff
         </div>
-        <button
-          onClick={onClose}
-          className="text-white/40 hover:text-white transition-colors mt-0.5 flex-shrink-0"
-        >
-          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
-            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
-          </svg>
-        </button>
+        <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
+          {!noData && <FavoriteButton playerName={player.name} />}
+          <button
+            onClick={onClose}
+            className="text-white/40 hover:text-white transition-colors"
+          >
+            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
+              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
+            </svg>
+          </button>
+        </div>
```

- [ ] **Step 5: Add to PlayerProfilePage hero**

In `frontend/src/pages/PlayerProfilePage.jsx`:

```diff
 import { useParams } from "react-router-dom";
 import { usePlayer } from "../hooks/usePlayer";
 import RadarChart from "../components/charts/RadarChart";
 import MatchCard from "../components/cards/MatchCard";
 import SportBadge from "../components/ui/SportBadge";
 import DnaLabel from "../components/ui/DnaLabel";
 import Avatar from "../components/ui/Avatar";
 import Skeleton from "../components/ui/Skeleton";
+import FavoriteButton from "../components/ui/FavoriteButton";
 import { ATTRIBUTES, SPORT_COLOR } from "../lib/attributes";
 import { ATTRIBUTE_ICONS } from "../lib/attributeIcons";
```

```diff
       <section className="glass p-6 min-w-0">
         <div className="flex items-center gap-3 mb-3">
           <Avatar sport={player.sport} src={player.headshot_url} size={80} />
           <div>
             <h1 className="text-2xl font-bold">{player.name}</h1>
             <div className="flex items-center gap-2 mt-1">
               <SportBadge sport={player.sport} />
               <span className="font-mono text-xs text-white/50">{player.position}</span>
             </div>
           </div>
+          <FavoriteButton playerName={player.name} className="ml-auto" />
         </div>
```

- [ ] **Step 6: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 7: Manual check**

With `npm run dev` running: logged out, clicking any bookmark icon (search results, a player profile's top matches, the universe popup, a player profile hero) navigates to `/login`. Logged in: clicking toggles the icon between outline and filled (accent-colored), and the same player shows the same state across every surface (since all read from the same `['favorites']` query cache).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ui/FavoriteButton.jsx frontend/src/components/cards/PlayerCard.jsx frontend/src/components/cards/MatchCard.jsx frontend/src/components/universe/PlayerPopup.jsx frontend/src/pages/PlayerProfilePage.jsx
git commit -m "Add favorite toggle to player cards, match cards, universe popup, and profile hero"
```

---

### Task 8: Profile page

**Files:**
- Create: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 2), `useComparisons()`/`useDeleteComparison()`, `useFavorites()`/`useRemoveFavorite()` (Task 5).

- [ ] **Step 1: Create ProfilePage**

Create `frontend/src/pages/ProfilePage.jsx`:

```jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useComparisons, useDeleteComparison } from "../hooks/useComparisons";
import { useFavorites, useRemoveFavorite } from "../hooks/useFavorites";
import { pct, enc } from "../lib/format";

function EmptyState({ label }) {
  return <div className="text-sm text-white/40 py-6 text-center">{label}</div>;
}

function ComparisonRow({ comparison, onDelete }) {
  return (
    <div className="glass p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="truncate font-medium">{comparison.player_a}</span>
          <span className="text-white/30">×</span>
          <span className="truncate font-medium">{comparison.player_b}</span>
        </div>
        {comparison.similarity_score != null && (
          <div className="font-mono text-xs mt-1" style={{ color: "#e8ff47" }}>
            {pct(comparison.similarity_score)} similar
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to={`/compare/${enc(comparison.player_a)}/${enc(comparison.player_b)}`}
          className="font-mono text-xs text-accent hover:underline"
        >
          View →
        </Link>
        <button
          type="button"
          onClick={() => onDelete(comparison.id)}
          className="text-white/40 hover:text-red-400 transition-colors font-mono text-xs"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function FavoriteRow({ favorite, onDelete }) {
  return (
    <div className="glass p-4 flex items-center justify-between gap-4">
      <Link to={`/player/${enc(favorite.player_name)}`} className="truncate font-medium hover:text-accent">
        {favorite.player_name}
      </Link>
      <button
        type="button"
        onClick={() => onDelete(favorite.id)}
        className="text-white/40 hover:text-red-400 transition-colors font-mono text-xs shrink-0"
      >
        Remove
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { data: comparisons = [], isLoading: comparisonsLoading } = useComparisons();
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites();
  const deleteComparison = useDeleteComparison();
  const removeFavorite = useRemoveFavorite();

  if (loading) {
    return <div className="max-w-4xl mx-auto p-8 text-center text-white/40">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <p className="text-white/60 mb-4">Log in to view your profile.</p>
        <Link to="/login" className="text-accent font-mono hover:underline">Log in →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <section className="glass p-6 flex items-center gap-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center font-mono text-xl font-bold shrink-0"
          style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #4a7fff 100%)" }}
        >
          {user.email[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{user.email}</h1>
          <p className="text-sm text-white/50">My CrossOver profile</p>
        </div>
        <div className="ml-auto flex gap-6 shrink-0">
          <div className="text-center">
            <div className="font-mono text-2xl font-bold" style={{ color: "#e8ff47" }}>{comparisons.length}</div>
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">Comparisons</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold" style={{ color: "#e8ff47" }}>{favorites.length}</div>
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">Favorites</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-wider mb-3">Saved Comparisons</h2>
        {comparisonsLoading ? (
          <EmptyState label="Loading…" />
        ) : comparisons.length === 0 ? (
          <EmptyState label="No saved comparisons yet." />
        ) : (
          <div className="grid gap-3">
            {comparisons.map((c) => (
              <ComparisonRow key={c.id} comparison={c} onDelete={(id) => deleteComparison.mutate(id)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-wider mb-3">Favorites</h2>
        {favoritesLoading ? (
          <EmptyState label="Loading…" />
        ) : favorites.length === 0 ? (
          <EmptyState label="No favorites yet." />
        ) : (
          <div className="grid gap-3">
            {favorites.map((f) => (
              <FavoriteRow key={f.id} favorite={f} onDelete={(id) => removeFavorite.mutate(id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.jsx`:

```diff
 import AuthPage from "./pages/AuthPage";
+import ProfilePage from "./pages/ProfilePage";
```

```diff
         <Route path="/login" element={<AuthPage />} />
+        <Route path="/profile" element={<ProfilePage />} />
       </Routes>
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 4: Manual check**

With `npm run dev` running: visiting `/profile` while logged out shows the "Log in to view your profile" prompt. While logged in, it shows the real email, real comparison/favorite counts matching the lists below, and "Remove" on each row actually deletes it (confirm via a page refresh that it stays removed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProfilePage.jsx frontend/src/App.jsx
git commit -m "Add profile page with real saved comparisons and favorites"
```

---

### Task 9: End-to-end manual verification

No new files — this is a final walkthrough tying every previous task together.

- [ ] **Step 1: Start both servers**

Run in one terminal: `cd backend && <the project's existing backend run command>`
Run in another terminal: `cd frontend && npm run dev`

- [ ] **Step 2: Full flow checklist**

Walk through and confirm each of these in the browser at `http://localhost:5173`:
1. Logged out: nav shows "Log in / Sign up"; `/profile` prompts to log in; bookmark icons and the save-comparison button all redirect to `/login` when clicked.
2. Sign up with a new email/password on `/login` → redirected to `/`, nav now shows the new email + "Log out".
3. On any comparison page, click "Save comparison" → see the "Saved" confirmation.
4. On a player card / match card / universe popup / player profile, click the bookmark icon → it fills in (accent color) and stays filled after a page refresh.
5. Go to `/profile` → see the real email, the saved comparison from step 3, the favorite from step 4, with correct counts.
6. Remove the saved comparison and the favorite from `/profile` → both lists update immediately and stay gone after a refresh.
7. Log out → nav reverts to "Log in / Sign up"; `/profile` prompts to log in again.
8. Log back in with the same credentials → session and data (saved items) persist correctly (confirms the httpOnly cookie round-trip works with `withCredentials: true`).

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: no errors (warnings acceptable only if they pre-exist on `main`; compare against `git stash` if unsure).
