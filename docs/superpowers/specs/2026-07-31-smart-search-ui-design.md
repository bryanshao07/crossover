# Smart Search UI (Semantic Search Toggle) — Design Spec

**Date:** 2026-07-31
**Branch:** `feature/smart-search-ui`
**Status:** Approved design, pending implementation plan

## Goal

The RAG layer (shipped in #13) already exposes semantic search on the backend:
`GET /search?mode=semantic&q=...` embeds the query with Gemini and returns
players ranked by cosine similarity against the style-card embeddings.

Nothing in the UI reaches it. The Search Results page still does substring
keyword matching only, so a query like "lockdown defender with elite passing"
returns zero results. This spec adds a **Smart Search toggle** to the Search
Results page that lets users search by natural-language meaning.

## Backend contract (dependency — already on `main`, no changes)

`backend/routers/players.py::search` accepts `q`, `sport`, `position`, `mode`.

- `mode` absent or not `"semantic"` → substring keyword search over all players.
- `mode=semantic` **and** non-empty `q` → `rag.semantic_search(...)`, returning
  names ranked by cosine similarity, capped at **30**.
- `sport`/`position` are applied inside `semantic_search` *before* the cap, so
  passing them server-side would yield a true top-30 within that filter. This
  design deliberately does **not** use that capability — see §3 — because each
  filter change would then cost an embedding call.
- If the embedding matrix or the Gemini key is unavailable, `semantic_search`
  returns `None` and the endpoint transparently falls through to keyword search.

Response is a JSON array of player rows — the **same shape** keyword search
already returns (name, sport, position, dna, the 7 attribute floats,
`headshot_url`), so `PlayerCard` renders semantic results unchanged.

**No backend changes are in scope.** If implementation appears to require one,
stop and raise it.

## Core constraint: semantic queries cost money

Every semantic request is a live Gemini embedding call — real cost, ~150–300ms
latency, and the project's `GEMINI_API_KEY` is on the free tier and already hits
429s under bulk load. The design is shaped primarily around **minimizing
embedding calls**.

Two mechanisms achieve that:

1. **Submit-gated queries** — semantic search fires only on explicit submit.
2. **Client-side filtering** — sport/position pills never trigger a new request.

## Design

### 1. Request layer

`frontend/src/api/client.js` — `search({ q, sport, position, mode })` gains
`mode: mode || undefined` in its params object. No other call site passes `mode`,
so existing behavior is untouched.

`frontend/src/hooks/useSearch.js` — gains an optional second argument:

```js
useSearch(filters, { enabled } = {})
```

`enabled` is forwarded to `useQuery` so Smart mode can sit idle before the first
submit. The argument is optional and defaults to enabled, so the existing
`useSearch({})` call in `ProfilePage.jsx:20` keeps working unchanged.

### 2. Submit gating

The page holds two pieces of query state:

- `q` — the live, per-keystroke input value.
- `submittedQ` — written **only** on explicit submit (Enter or the search
  button).

The value fed into the react-query key depends on mode:

| Mode | Query key contains | Refetches when |
| --- | --- | --- |
| Keyword | `q` (live) | every keystroke — unchanged from today |
| Smart | `submittedQ` + `mode: "semantic"` | only on explicit submit |

Because the live `q` is **not part of the query key** in Smart mode, react-query
is structurally incapable of refetching on keystroke. This is a stronger
guarantee than a debounce, which only delays calls.

When Smart mode is active and `submittedQ` is empty, the hook is called with
`enabled: false`, so zero requests fire while the user is still typing their
first query.

### 3. Filtering — one uniform client-side path

Sport **and** position are filtered client-side in both modes, and `position`
stops being sent to the server.

Rationale: in Smart mode a pill click must not cost an embedding call, so
filtering has to happen client-side there. Applying the same rule to keyword
mode yields one code path instead of a mode-conditional one. For keyword mode
the visible result set is identical — the same predicate, applied in the browser
instead of on the server — it merely drops a query param and returns a slightly
larger payload on a request the page already makes.

**Counts** keep exactly today's semantics: computed over the rows matching the
current *position* filter, then broken down by sport for the ALL/NBA/SOCCER
pills. In Smart mode this means the counts describe the returned ranked set
("of these 30 results, 12 are NBA"), which is honest about what the user is
looking at.

**Ranking order is preserved end to end.** Nothing sorts; `Array.prototype
.filter` and `.slice` are order-stable, so the backend's cosine ranking survives
filtering and pagination intact.

### 4. Toggle component

New file: `frontend/src/components/ui/SearchModeToggle.jsx`.

A two-option segmented control ("KEYWORD" / "SMART"), positioned at the right of
the position-pill row — the slot where `mockups/search-results.png` shows the
"Sort by: Relevance" control.

Visual spec, per the design system:

- Container: 1px `white/15` border, `rounded-sm` (2px), glass background.
- Active segment: `#e8ff47` fill with `#0a0a0f` text.
- Inactive segment: `text-white/60`, hover to `text-white`.
- JetBrains Mono, `text-xs`, uppercase — matching `FilterPill`'s type treatment.

Built from scratch with Tailwind. No component library, no new dependency.
It is a separate component rather than a `FilterPill` variant because a mode
switch is a different affordance from a filter chip and must not read as a third
row of filters.

### 5. States

- **Smart, nothing submitted yet** — an idle hint prompting the user to describe
  a player and press Enter. Explicitly *not* the "no matches" message, which
  would wrongly imply a search ran and failed. This state is selected on
  `smart && !submittedQ`, never on a loading flag: a disabled react-query stays
  `pending` forever, so branching on query status here would be wrong.
- **Smart, request in flight** — the existing `PlayerCardSkeleton` grid, shown
  when `isLoading || (smart && isFetching)`. The `isFetching` term matters
  because a re-submit of a previously cached query would otherwise show no
  loading feedback.
- **Zero results after filtering** — a clear "no matches" message.
- **Placeholder** — `"Search for a player"` in keyword mode; in Smart mode,
  `"Describe a player — e.g. 'elite rim protector'"`.
- **Mode switches** — Smart → Keyword resumes live keyword search immediately
  using the current text. Keyword → Smart keeps the typed text and waits for an
  explicit submit; it does not auto-fire.
- **Page reset** — `page` resets to 0 on submit, mode change, sport change,
  position change, and (in keyword mode) on typing.

### 6. Accessibility

- The input is wrapped in a `<form onSubmit>`, so Enter submits natively with no
  key handler. In keyword mode submit is a no-op beyond `preventDefault()`.
- An explicit search button sits inside the input row and is rendered in **both**
  modes (avoiding layout shift when toggling), labeled for screen readers. In
  keyword mode it is a harmless no-op; in Smart mode it is the submit affordance.
- The toggle is a `role="radiogroup"` containing two `role="radio"` buttons with
  `aria-checked` — the correct primitive for a mutually exclusive mode choice.
  Both are tab-reachable and operable with Enter/Space as native buttons.
- The result count is announced via an `aria-live="polite"` region.

## Files touched

| File | Change |
| --- | --- |
| `frontend/src/api/client.js` | pass `mode` through to `/search` |
| `frontend/src/hooks/useSearch.js` | optional `{ enabled }` second arg |
| `frontend/src/pages/SearchResultsPage.jsx` | mode state, submit gating, client-side filtering, states |
| `frontend/src/components/ui/SearchModeToggle.jsx` | new segmented control |

No backend changes. `PlayerCard`, `PlayerCardSkeleton`, and `FilterPill` are
reused unmodified.

## Pagination

Semantic responses cap at 30 results and the page shows 24 per page, so Smart
mode yields at most 2 pages. The existing pagination component handles this with
no changes.

## Explicitly out of scope (YAGNI)

- A "re-run for top 30 within this filter" action. Considered and rejected: it
  adds UI surface and a second opt-in cost path for marginal benefit.
- Persisting mode in the URL or localStorage.
- Position-level counts on the position pills.
- Any change to the homepage search or its autocomplete.
- Surfacing similarity scores on result cards — the backend returns rank order,
  not per-row scores, on this endpoint.

## Verification

- `curl "http://localhost:8000/search?q=lockdown%20defender%20with%20elite%20passing&mode=semantic"`
  returns ranked players; the same query without `mode` returns few or none.
- In the browser, Smart mode fires exactly **one** `/api/search` request per
  submit — confirmed in devtools Network — and **zero** requests while typing.
- Sport/position pill clicks in Smart mode issue no network request at all.
- Keyword mode still updates live per keystroke.
- Requests go to `localhost:5173/api/search`, not a remote Render host.
- `npm run lint` passes before each commit.
