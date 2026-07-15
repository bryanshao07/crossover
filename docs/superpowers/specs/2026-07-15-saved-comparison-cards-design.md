# Saved Comparison Cards — Design

## Context

The Profile page (`frontend/src/pages/ProfilePage.jsx`) has a "Saved Comparisons" section that currently renders each saved comparison as a plain text row (`ComparisonRow`): name × name, a similarity percentage, a "View →" link, and a "Remove" text button. No player photos or sport badges.

The user wants this section restyled as visual cards — player photos, sport badges, a large similarity percentage, and a progress bar — matching the card style already used elsewhere in the app for match/matchup lists (e.g. "TOP SOCCER MATCHES" on the player profile mockup, "POPULAR MATCHUPS" on the comparison-picker mockup).

## Data Gap

`SavedComparison` (backend `db_models.py`, exposed via `routers/comparisons.py`) only stores `player_a` / `player_b` as name strings plus `similarity_score`. It has no `sport` or `headshot_url`. To render photos and sport badges, the frontend must resolve each name against the full player list.

`usePlayers()` (`frontend/src/hooks/usePlayers.js`) already fetches `/players` with `staleTime: Infinity`, and each player record includes `sport` and `headshot_url` (confirmed in `backend/routers/players.py`). `ProfilePage` will call this hook alongside the existing `useComparisons()` / `useFavorites()` calls and build a `name → player` lookup map to resolve both sides of each saved comparison before rendering.

Player names in saved comparisons always originate from this same canonical player list, so no fallback handling is needed for an unresolved name.

## Component: `SavedComparisonCard`

New file: `frontend/src/components/cards/SavedComparisonCard.jsx`, replacing the `ComparisonRow` function currently defined inline in `ProfilePage.jsx`.

Props: `comparison` (`{ id, similarity_score }`), `playerA`, `playerB` (resolved player objects with `name`, `sport`, `headshot_url`).

Structure (top to bottom), reusing existing primitives (`Avatar`, `SportBadge`, `pct`):

1. Header row: `SportBadge` for `playerA` on the left; `SportBadge` for `playerB` and a bookmark icon on the right.
2. Photo row: `Avatar` (56px) for `playerA`, a `×` separator, `Avatar` (56px) for `playerB`.
3. Name row: both player names, truncating with `title` for overflow.
4. Similarity row: large accent-colored (`#e8ff47`) percentage via `pct(similarity_score)` + a small uppercase "SIMILAR" label, followed by a thin fill bar underneath (track `bg-white/10`, fill `bg-accent` sized to `similarity_score * 100%`).

The whole card is a `<Link>` to `/compare/{playerA.name}/{playerB.name}` (URL-encoded), matching the "card = view" interaction. The bookmark icon is always rendered filled/accent-colored (these are already-saved items), stops event propagation/prevents default on click, and calls `useDeleteComparison().mutate(comparison.id)` directly inside the card — the same self-contained hook pattern `FavoriteButton.jsx` already uses for favorites, so no callback prop drilling is needed.

## ProfilePage changes

- Remove the inline `ComparisonRow` function.
- Add `usePlayers()` and build a `Map` from player name to player object.
- Replace the `grid gap-3` list of `ComparisonRow` with a responsive wrapping grid of `SavedComparisonCard`: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
- No horizontal scroll and no "View All" affordance — this section is already the complete list of the user's saved comparisons, unlike the "preview strip" pattern used for match lists elsewhere.
- The `Favorites` section and its `FavoriteRow` are unaffected by this change.
- `EmptyState` / loading handling for the Saved Comparisons section is unchanged.

## Out of scope

- Backend/data model changes (no new fields added to `SavedComparison`).
- Any change to the Favorites section.
- Any change to the "TOP SOCCER MATCHES" / "POPULAR MATCHUPS" preview-strip components elsewhere in the app.
