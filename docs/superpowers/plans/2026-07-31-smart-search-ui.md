# Smart Search UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Keyword/Smart mode toggle to the CrossOver Search Results page that routes natural-language queries to the existing `mode=semantic` backend endpoint, firing at most one Gemini embedding call per explicit submit.

**Architecture:** Four frontend files. `api/client.js` forwards a new `mode` param; `hooks/useSearch.js` gains an optional `{ enabled }` passthrough; a new `SearchModeToggle` component renders the segmented control; `SearchResultsPage.jsx` holds the mode state and splits its query state into live `q` (keyword) and `submittedQ` (semantic). The cost guarantee is structural: the live `q` never enters the react-query key in semantic mode, so keystroke refetch is impossible rather than merely debounced. Sport and position filter client-side in both modes, so pill clicks issue no request.

**Tech Stack:** React 19, Vite 8, TanStack Query v5, Tailwind 3, axios, lucide-react (all already installed — no new dependencies).

**Spec:** `docs/superpowers/specs/2026-07-31-smart-search-ui-design.md`

## Global Constraints

- Branch: `feature/smart-search-ui`. Commit after each task.
- No new dependencies. No component library. Build with Tailwind from scratch.
- No backend changes. If a task appears to need one, stop and ask.
- Design tokens (from `tailwind.config.js`, use these names, not raw hex):
  `bg` = `#0a0a0f`, `accent` = `#e8ff47`, `nba` = `#4a7fff`, `soccer` = `#39d353`.
- Border radius: `rounded-sm` (2px) or `rounded` (3px) only. No pill shapes.
- Numbers/labels use `font-mono` (JetBrains Mono), uppercase for attribute-style labels.
- `npm run lint` must pass before every commit.
- Node is not on the default PATH. Every terminal command in this plan must be
  preceded once per shell by:
  `export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"`
- `frontend/.env.local` must contain `VITE_API_BASE_URL=/api` for local testing
  (already correct — verify, don't assume).

## Testing Approach — read this before Task 1

**This repo has no frontend test framework.** `frontend/package.json` has no
test script and there are zero `*.test.jsx` files; the only devDeps are eslint,
vite, tailwind and types. Adding vitest + testing-library + jsdom would mean
four new devDependencies and a config file, which is outside the approved scope.

Therefore the verification gate for every task below is:

1. `npm run lint` — must report zero errors.
2. `npm run build` — must succeed (catches import and syntax errors).
3. An explicit **manual verification protocol** with observable pass/fail
   criteria, given per task.

The highest-risk behavior (semantic fires only on submit; pill clicks fire no
request) is verified in Task 4 by counting requests in the devtools Network
panel, which is a real empirical check, not an eyeball test.

If you want automated regression coverage for the request-gating behavior,
that is a worthwhile follow-up but requires approval to add the test stack.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/src/api/client.js` | HTTP layer — forward `mode` to `/search` |
| `frontend/src/hooks/useSearch.js` | react-query binding — accept `{ enabled }` |
| `frontend/src/components/ui/SearchModeToggle.jsx` | **new** — presentational segmented control, no data access |
| `frontend/src/pages/SearchResultsPage.jsx` | mode/query state, gating, filtering, states |

---

### Task 1: Forward `mode` through the API client

**Files:**
- Modify: `frontend/src/api/client.js:20-23`

**Interfaces:**
- Consumes: nothing.
- Produces: `api.search({ q, sport, position, mode })` — `mode` is an optional
  string; the only value the app sends is `"semantic"`. Falsy values are omitted
  from the query string entirely.

- [ ] **Step 1: Add the `mode` param**

Replace the existing `search` entry with:

```js
  search: ({ q, sport, position, mode }) =>
    http
      .get("/search", {
        params: {
          q: q || undefined,
          sport: sport || undefined,
          position: position || undefined,
          mode: mode || undefined,
        },
      })
      .then((r) => r.data),
```

The `|| undefined` pattern matches the existing style — axios drops `undefined`
params, so a keyword-mode request produces the exact same URL it does today.

- [ ] **Step 2: Verify the backend honors it**

With the backend running (`cd backend && venv/bin/uvicorn main:app --reload --port 8000`):

```bash
curl -s "http://localhost:8000/search?q=lockdown%20defender%20with%20elite%20passing&mode=semantic" | head -c 300
curl -s "http://localhost:8000/search?q=lockdown%20defender%20with%20elite%20passing" | head -c 300
```

Expected: the first returns a populated JSON array of player objects; the second
returns `[]` or near-empty. If the first is also empty, the RAG artifacts or
`GEMINI_API_KEY` are missing — stop and report, do not work around it.

- [ ] **Step 3: Lint and commit**

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
cd frontend && npm run lint
git add src/api/client.js
git commit -m "Forward mode param to /search in API client"
```

---

### Task 2: Let `useSearch` be conditionally disabled

**Files:**
- Modify: `frontend/src/hooks/useSearch.js`

**Interfaces:**
- Consumes: `api.search` from Task 1.
- Produces: `useSearch(filters, options?)` where `options` is an optional
  react-query options object (only `enabled` is used by this feature). Returns
  the standard react-query result — this feature reads `data`, `isLoading`,
  `isFetching`.

**Why:** semantic mode must issue zero requests before the first submit.
`ProfilePage.jsx:20` calls `useSearch({})` with one argument, so the second
parameter must be optional and default to enabled.

- [ ] **Step 1: Add the options passthrough**

Replace the file body with:

```js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

// `options` is an optional react-query options passthrough. Smart search uses
// it to stay disabled until the user submits a query, so that typing never
// triggers a billable Gemini embedding call.
export const useSearch = (filters, options = {}) =>
  useQuery({
    queryKey: ["search", filters],
    queryFn: () => api.search(filters),
    ...options,
  });
```

- [ ] **Step 2: Verify the existing caller still works**

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
cd frontend && npm run lint && npm run build
```

Expected: both succeed. Then with `npm run dev` running, load
`http://localhost:5173/profile` and confirm the player list still populates —
that page's `useSearch({})` call must be unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSearch.js
git commit -m "Allow useSearch to accept react-query options"
```

---

### Task 3: Build the `SearchModeToggle` component

**Files:**
- Create: `frontend/src/components/ui/SearchModeToggle.jsx`

**Interfaces:**
- Consumes: nothing (pure presentational, no hooks beyond `useRef`).
- Produces: default export `SearchModeToggle({ mode, onChange })` where `mode`
  is `"keyword" | "semantic"` and `onChange` is `(next: "keyword" | "semantic") => void`.
  Task 4 imports this exact signature.

**Accessibility note:** this implements the full ARIA radiogroup pattern —
roving tabindex (only the selected button is in the tab order) plus arrow-key
navigation. Do not simplify to two independently-tabbable buttons; that is an
incomplete radiogroup.

- [ ] **Step 1: Create the component**

```jsx
import { useRef } from "react";

const MODES = [
  { key: "keyword", label: "KEYWORD" },
  { key: "semantic", label: "SMART" },
];
const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

// Segmented control for choosing between substring keyword search and
// natural-language semantic search. Implements the ARIA radiogroup pattern:
// roving tabindex + arrow-key navigation.
export default function SearchModeToggle({ mode, onChange }) {
  const refs = useRef([]);

  const handleKeyDown = (e) => {
    if (!ARROWS.includes(e.key)) return;
    e.preventDefault();
    const i = MODES.findIndex((m) => m.key === mode);
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    const next = (i + (back ? MODES.length - 1 : 1)) % MODES.length;
    onChange(MODES[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Search mode"
      onKeyDown={handleKeyDown}
      className="inline-flex items-center gap-1 rounded-sm border border-white/15 bg-white/5 p-1"
    >
      {MODES.map((m, i) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(m.key)}
            className={`font-mono text-xs px-3 py-1 rounded-sm transition-colors ${
              active
                ? "bg-accent text-bg font-semibold"
                : "text-white/60 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
cd frontend && npm run lint
```

Expected: zero errors. Note `refs.current[i] = el` inside a ref callback is an
assignment expression; if eslint flags the implicit return, wrap the body in
braces: `ref={(el) => { refs.current[i] = el; }}`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SearchModeToggle.jsx
git commit -m "Add SearchModeToggle segmented control"
```

---

### Task 4: Wire the toggle into the Search Results page

**Files:**
- Modify: `frontend/src/pages/SearchResultsPage.jsx` (full rewrite of the component body)

**Interfaces:**
- Consumes: `useSearch(filters, { enabled })` (Task 2), `api.search`'s `mode`
  param (Task 1), `SearchModeToggle({ mode, onChange })` (Task 3).
- Produces: nothing — this is a route leaf.

**Behavioral requirements this task must satisfy:**

1. Keyword mode refetches on every keystroke (unchanged from today).
2. Semantic mode refetches **only** on form submit.
3. Sport and position filter client-side in both modes; `position` is no longer
   sent to the server.
4. Semantic ranking order is preserved (never sort — `filter`/`slice` only).
5. Idle, loading, and empty states are distinct.

- [ ] **Step 1: Replace the file**

```jsx
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import PlayerCard from "../components/cards/PlayerCard";
import PlayerCardSkeleton from "../components/ui/PlayerCardSkeleton";
import FilterPill from "../components/ui/FilterPill";
import SearchModeToggle from "../components/ui/SearchModeToggle";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "FW", "MF", "DF"];
const PAGE = 24;
const SPORT_PILLS = [
  { key: "", label: "ALL", color: "#e8ff47" },
  { key: "basketball", label: "NBA", color: "#4a7fff" },
  { key: "soccer", label: "SOCCER", color: "#39d353" },
];

export default function SearchResultsPage() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [mode, setMode] = useState("keyword");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(0);

  const semantic = mode === "semantic";

  // Each semantic query is a live Gemini embedding call, so in semantic mode
  // only the *submitted* query feeds the react-query key -- typing cannot
  // refetch, because the live `q` is not part of the key at all. Keyword mode
  // keeps its live per-keystroke behaviour.
  const filters = semantic ? { q: submittedQ, mode: "semantic" } : { q };
  const { data = [], isLoading, isFetching } = useSearch(filters, {
    enabled: !semantic || submittedQ !== "",
  });

  // Sport and position are filtered client-side in both modes so that changing
  // a pill in semantic mode costs nothing. filter/slice preserve order, which
  // keeps the backend's cosine ranking intact.
  const matching = useMemo(
    () => (position ? data.filter((p) => p.position === position) : data),
    [data, position],
  );
  const counts = useMemo(
    () => ({
      "": matching.length,
      basketball: matching.filter((p) => p.sport === "basketball").length,
      soccer: matching.filter((p) => p.sport === "soccer").length,
    }),
    [matching],
  );
  const results = sport ? matching.filter((p) => p.sport === sport) : matching;
  const pages = Math.ceil(results.length / PAGE);
  const slice = results.slice(page * PAGE, page * PAGE + PAGE);

  // A disabled react-query stays `pending` forever, so the idle state is keyed
  // off the submitted query, never off a loading flag.
  const idle = semantic && !submittedQ;
  const busy = !idle && (isLoading || (semantic && isFetching));

  const submit = (e) => {
    e.preventDefault();
    if (!semantic) return;
    setSubmittedQ(q.trim());
    setPage(0);
  };

  const changeMode = (next) => {
    setMode(next);
    setPage(0);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <form onSubmit={submit} className="mb-4">
        <div className="flex items-center gap-3 bg-white/5 border border-white/15 rounded px-3 transition-colors focus-within:border-accent">
          <Search size={16} className="shrink-0 text-white/40" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!semantic) setPage(0);
            }}
            placeholder={
              semantic
                ? "Describe a player — e.g. 'elite rim protector'"
                : "Search for a player"
            }
            aria-label="Search players"
            className="w-full bg-transparent py-3 outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="shrink-0 font-mono text-xs px-3 py-1 rounded-sm border border-white/15 text-white/60 transition-colors hover:border-accent hover:text-accent"
          >
            SEARCH
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {SPORT_PILLS.map((s) => (
          <FilterPill
            key={s.key || "all"}
            active={sport === s.key}
            color={s.color}
            onClick={() => {
              setSport(s.key);
              setPage(0);
            }}
          >
            {s.label} ({counts[s.key]})
          </FilterPill>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <FilterPill
          active={position === ""}
          onClick={() => {
            setPosition("");
            setPage(0);
          }}
        >
          ALL POS
        </FilterPill>
        {POSITIONS.map((p) => (
          <FilterPill
            key={p}
            active={position === p}
            onClick={() => {
              setPosition(p);
              setPage(0);
            }}
          >
            {p}
          </FilterPill>
        ))}
        <div className="ml-auto">
          <SearchModeToggle mode={mode} onChange={changeMode} />
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {busy ? "Searching" : `${results.length} results`}
      </div>

      {idle ? (
        <div className="border border-white/10 bg-white/[0.02] rounded-sm p-10 text-center">
          <p className="font-mono text-xs text-accent mb-2">SMART SEARCH</p>
          <p className="text-sm text-white/60">
            Describe a playing style and press Enter — try “lockdown defender
            with elite passing”.
          </p>
        </div>
      ) : busy ? (
        <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PlayerCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="border border-white/10 bg-white/[0.02] rounded-sm p-10 text-center">
          <p className="font-mono text-xs text-white/40 mb-2">NO MATCHES</p>
          <p className="text-sm text-white/60">
            {semantic
              ? "No players matched that description. Try describing a playing style differently."
              : "No players matched that name."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
          {slice.map((p) => (
            <PlayerCard key={p.name} player={p} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 font-mono text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((n) => n - 1)}
            className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-white/50">
            {page + 1} / {pages}
          </span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((n) => n + 1)}
            className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint and build**

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
cd frontend && npm run lint && npm run build
```

Expected: both pass with zero errors.

- [ ] **Step 3: Manual verification protocol — the real test**

Start both servers (backend on 8000, `npm run dev` on 5173), open
`http://localhost:5173/search`, open devtools → Network, filter to `search`.

Run each check and record pass/fail:

| # | Action | Required observation |
| --- | --- | --- |
| 1 | Keyword mode, type `jam` slowly | A request per keystroke — live behavior preserved |
| 2 | Requests in check 1 | URL is `localhost:5173/api/search?...`, **no** `mode` param, **no** remote Render host |
| 3 | Click SMART | Zero new requests. Idle panel shows, not "no matches" |
| 4 | Type `lockdown defender with elite passing` (do not press Enter) | **Zero** requests fired during the entire typing |
| 5 | Press Enter | **Exactly one** request, with `mode=semantic`. Skeletons appear, then cards |
| 6 | Compare to keyword | Results are semantically relevant defenders/passers, and clearly different from keyword results for the same string |
| 7 | Click NBA / SOCCER / a position pill | **Zero** new requests. Grid filters instantly, counts update |
| 8 | Note the first 3 card names, then click NBA and back to ALL | Order of remaining cards unchanged — ranking preserved |
| 9 | Tab to the toggle, press Arrow keys | Focus and selection move between KEYWORD/SMART |
| 10 | Switch back to KEYWORD | Live per-keystroke search resumes immediately with the current text |
| 11 | Smart mode, submit gibberish like `zzzzqqq` | Either ranked results or the "no matches" panel — never a crash or infinite skeleton |

Check 4 and check 7 are the cost guarantees. If either fires a request, the
implementation is wrong — do not proceed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SearchResultsPage.jsx
git commit -m "Add Smart Search mode toggle to search results page"
```

---

### Task 5: Open the pull request

**Files:** none.

- [ ] **Step 1: Final full verification**

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
cd frontend && npm run lint && npm run build
```

Both must pass. Re-run the Task 4 checks 4, 5 and 7 one final time against the
built state.

- [ ] **Step 2: Push and open the PR**

`gh` is not on the default PATH:

```bash
export PATH="/opt/homebrew/bin:$PATH"
git push -u origin feature/smart-search-ui
gh pr create --title "Add Smart Search (semantic) toggle to search page" --body "..."
```

The PR body should state: what it adds, the two cost-control mechanisms
(submit gating via query key, client-side filtering), the counts-in-semantic-mode
behavior, and that no automated tests exist for the frontend so verification was
lint + build + the manual protocol in the plan.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §1 Request layer — `mode` param | Task 1 |
| §1 Request layer — `{ enabled }` | Task 2 |
| §2 Submit gating | Task 4 (`filters`/`submittedQ`), verified by checks 4–5 |
| §3 Client-side filtering + counts + order | Task 4 (`matching`/`counts`/`results`), verified by checks 7–8 |
| §4 Toggle component | Task 3 |
| §5 States (idle/busy/empty/placeholder/mode-switch/page-reset) | Task 4, verified by checks 3, 10, 11 |
| §6 Accessibility (form submit, button label, radiogroup, aria-live) | Tasks 3 and 4, verified by check 9 |
| §Verification | Task 1 Step 2 (curl), Task 4 Step 3 (all rows) |

No spec requirement is unimplemented.

**Placeholder scan:** no TBD/TODO. Every code step contains complete, runnable
code. The only `"..."` is the PR body text in Task 5, whose required content is
specified in prose immediately below it.

**Type consistency:** `SearchModeToggle({ mode, onChange })` is defined in Task 3
and consumed with exactly those prop names in Task 4. Mode values are the string
literals `"keyword"` / `"semantic"` in both. `useSearch(filters, options)` is
defined in Task 2 and called with two arguments in Task 4. `api.search`'s
destructured `{ q, sport, position, mode }` in Task 1 is a superset of the
`{ q }` and `{ q, mode }` objects Task 4 passes — destructuring absent keys
yields `undefined`, which the `|| undefined` guards handle.

**Known deviation from spec §3:** the spec says `position` stops being sent to
the server. Task 4 implements this. Keyword-mode results are unchanged (same
predicate, applied client-side), but the keyword request payload is now the full
player list rather than a position-filtered one. This was explicitly approved.
