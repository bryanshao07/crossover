# Saved Comparison Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-text "Saved Comparisons" rows on the Profile page with visual cards showing both players' photos, sport badges, and a similarity bar.

**Architecture:** A new presentational card component (`SavedComparisonCard`) resolves each saved comparison's two player names against the already-cached full player list to get `sport`/`headshot_url`, then renders them using existing primitives (`Avatar`, `SportBadge`). `ProfilePage` swaps its plain-row list for a wrapping grid of these cards.

**Tech Stack:** React 19, Tailwind CSS, react-router-dom, @tanstack/react-query, lucide-react icons. No frontend test runner exists in this repo (`frontend/package.json` has no test script) — verification is via `eslint` plus manual checks in the running app, per this project's CLAUDE.md convention for frontend changes.

## Global Constraints

- No backend/data-model changes — `SavedComparison` keeps only `player_a`, `player_b`, `similarity_score` (spec: "Data Gap").
- Card is a single clickable `<Link>` to `/compare/{playerA.name}/{playerB.name}` (URL-encoded via `enc()`); the bookmark icon is the only other interactive element and stops propagation (spec: "Component: SavedComparisonCard").
- Bookmark icon is always rendered filled/accent-colored and calls `useDeleteComparison().mutate(comparison.id)` directly inside the card — no callback prop drilling (spec: "Component: SavedComparisonCard").
- Layout is a responsive wrapping grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`) — no horizontal scroll, no "View All" (spec: "ProfilePage changes").
- Player names in saved comparisons always resolve against the full player list — no fallback/guard needed for an unresolved name (spec: "Data Gap").
- Accent color for percentage text and bar fill is `#e8ff47` via the existing Tailwind `accent` token (spec: "Component: SavedComparisonCard").
- Favorites section and `FavoriteRow` are unchanged (spec: "Out of scope").

---

## File Structure

- **Create** `frontend/src/components/cards/SavedComparisonCard.jsx` — presentational card for one saved comparison. Owns its own delete (unsave) mutation, same self-contained pattern as `frontend/src/components/ui/FavoriteButton.jsx`.
- **Modify** `frontend/src/pages/ProfilePage.jsx` — remove the inline `ComparisonRow` function, add a `usePlayers()`-backed name lookup, render `SavedComparisonCard` in a grid.

---

### Task 1: Create `SavedComparisonCard`

**Files:**
- Create: `frontend/src/components/cards/SavedComparisonCard.jsx`

**Interfaces:**
- Consumes:
  - `Avatar` — default export from `frontend/src/components/ui/Avatar.jsx`, props `{ sport: "basketball"|"soccer", src: string|null, size: number }`.
  - `SportBadge` — default export from `frontend/src/components/ui/SportBadge.jsx`, props `{ sport: "basketball"|"soccer" }`.
  - `pct`, `enc` — named exports from `frontend/src/lib/format.js`. `pct(x)` returns `"91%"` for `x = 0.91`. `enc(name)` is `encodeURIComponent(name)`.
  - `useDeleteComparison` — named export from `frontend/src/hooks/useComparisons.js`. Returns a react-query mutation object: `.mutate(id)` triggers the delete, `.isPending` is a boolean.
  - `Bookmark` icon — named export from `lucide-react`.
- Produces:
  - Default export `SavedComparisonCard({ comparison, playerA, playerB })` where `comparison` is `{ id: number, similarity_score: number|null }` and `playerA`/`playerB` are each `{ name: string, sport: "basketball"|"soccer", headshot_url: string|null }`. Consumed by `ProfilePage.jsx` in Task 2.

- [ ] **Step 1: Write the component**

```jsx
import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { pct, enc } from "../../lib/format";
import { useDeleteComparison } from "../../hooks/useComparisons";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";

export default function SavedComparisonCard({ comparison, playerA, playerB }) {
  const deleteComparison = useDeleteComparison();

  function handleRemove(e) {
    e.preventDefault();
    e.stopPropagation();
    deleteComparison.mutate(comparison.id);
  }

  return (
    <Link
      to={`/compare/${enc(playerA.name)}/${enc(playerB.name)}`}
      className="glass p-4 flex flex-col gap-3 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <SportBadge sport={playerA.sport} />
        <div className="flex items-center gap-2">
          <SportBadge sport={playerB.sport} />
          <button
            type="button"
            onClick={handleRemove}
            disabled={deleteComparison.isPending}
            aria-label="Remove saved comparison"
            className="text-accent transition-colors hover:text-white/80 disabled:opacity-50"
          >
            <Bookmark className="w-4 h-4" fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Avatar sport={playerA.sport} src={playerA.headshot_url} size={56} />
        <span className="text-white/30 text-sm">×</span>
        <Avatar sport={playerB.sport} src={playerB.headshot_url} size={56} />
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="flex-1 min-w-0 truncate text-center" title={playerA.name}>
          {playerA.name}
        </span>
        <span className="flex-1 min-w-0 truncate text-center" title={playerB.name}>
          {playerB.name}
        </span>
      </div>

      {comparison.similarity_score != null && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-accent">
              {pct(comparison.similarity_score)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
              Similar
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-sm bg-white/10">
            <div
              className="h-full rounded-sm bg-accent"
              style={{ width: `${comparison.similarity_score * 100}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Lint the new file**

Run: `(cd frontend && npx eslint src/components/cards/SavedComparisonCard.jsx)`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/SavedComparisonCard.jsx
git commit -m "Add SavedComparisonCard component"
```

---

### Task 2: Wire `SavedComparisonCard` into `ProfilePage`

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`

**Interfaces:**
- Consumes:
  - `SavedComparisonCard` from Task 1 (`frontend/src/components/cards/SavedComparisonCard.jsx`), props as defined above.
  - `usePlayers` — named export from `frontend/src/hooks/usePlayers.js`. Returns a react-query result; `.data` is an array of player objects (`{ name, sport, headshot_url, position, dna, ... }`, defaults to `[]` if omitted), `.isLoading` is a boolean.
- Produces: n/a (top-level page component).

- [ ] **Step 1: Remove the inline `ComparisonRow` function and unused `pct` import**

In `frontend/src/pages/ProfilePage.jsx`, delete the `ComparisonRow` function (originally lines 13-45):

```jsx
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
```

Change the top import block from:

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useComparisons, useDeleteComparison } from "../hooks/useComparisons";
import { useFavorites, useRemoveFavorite } from "../hooks/useFavorites";
import { pct, enc, resolveAvatarUrl } from "../lib/format";
import AvatarPickerModal from "../components/profile/AvatarPickerModal";
```

to:

```jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useComparisons } from "../hooks/useComparisons";
import { useFavorites, useRemoveFavorite } from "../hooks/useFavorites";
import { usePlayers } from "../hooks/usePlayers";
import { enc, resolveAvatarUrl } from "../lib/format";
import AvatarPickerModal from "../components/profile/AvatarPickerModal";
import SavedComparisonCard from "../components/cards/SavedComparisonCard";
```

(`useDeleteComparison` and `pct` are no longer used at the page level — `SavedComparisonCard` owns both now. `enc` stays, since `FavoriteRow` still uses it.)

- [ ] **Step 2: Add the player lookup and replace the Saved Comparisons section**

Inside `ProfilePage()`, change:

```jsx
export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { data: comparisons = [], isLoading: comparisonsLoading } = useComparisons();
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites();
  const deleteComparison = useDeleteComparison();
  const removeFavorite = useRemoveFavorite();
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
```

to:

```jsx
export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { data: comparisons = [], isLoading: comparisonsLoading } = useComparisons();
  const { data: favorites = [], isLoading: favoritesLoading } = useFavorites();
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const removeFavorite = useRemoveFavorite();
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const playersByName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
```

Then change the "Saved Comparisons" section from:

```jsx
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
```

to:

```jsx
      <section>
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-wider mb-3">Saved Comparisons</h2>
        {comparisonsLoading || playersLoading ? (
          <EmptyState label="Loading…" />
        ) : comparisons.length === 0 ? (
          <EmptyState label="No saved comparisons yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparisons.map((c) => (
              <SavedComparisonCard
                key={c.id}
                comparison={c}
                playerA={playersByName.get(c.player_a)}
                playerB={playersByName.get(c.player_b)}
              />
            ))}
          </div>
        )}
      </section>
```

- [ ] **Step 3: Lint the modified file**

Run: `(cd frontend && npx eslint src/pages/ProfilePage.jsx)`
Expected: no output, exit code 0.

- [ ] **Step 4: Manually verify in the running app**

Run: `(cd frontend && npm run dev)` (leave running; in a separate terminal, ensure the backend is also running per this project's normal `backend/` startup).

In the browser:
1. Log in (or sign up) as a test user.
2. Go to a player comparison page (e.g. via Search or Compare) and click "Save comparison" if you have no saved comparisons yet, so the Profile page has at least one card to show.
3. Navigate to `/profile`.
4. Confirm each Saved Comparisons entry renders as a card with: an NBA/SOCCER badge for each player, both circular player photos with a "×" between them, both player names, a large accent-colored percentage with "SIMILAR" label, and a filled bar proportional to that percentage.
5. Confirm clicking the bookmark icon removes that card without navigating away from `/profile`.
6. Confirm clicking anywhere else on a card navigates to `/compare/<playerA>/<playerB>`.
7. Resize the browser window and confirm the grid re-flows from 1 to 2 to 3 columns.

Expected: all of the above match, with no console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProfilePage.jsx
git commit -m "Render saved comparisons as cards on the Profile page"
```
