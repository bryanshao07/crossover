# Prevent Duplicate Saved Comparisons — Design

## Context

`SaveComparisonButton` (`frontend/src/pages/ComparisonPage.jsx:194`) lets a logged-in user save the currently viewed comparison via `useSaveComparison()`. It has no awareness of the user's existing saved comparisons, so clicking it repeatedly — or viewing the same pair in reverse order (A×B vs B×A) — creates duplicate rows.

## Fix

`SaveComparisonButton` also calls `useComparisons()` (already used elsewhere, e.g. the Profile page) to read the user's saved list, and computes:

```js
const alreadySaved = comparisons.some(
  (c) =>
    (c.player_a === playerA && c.player_b === playerB) ||
    (c.player_a === playerB && c.player_b === playerA)
);
```

Order-independent, per the confirmed decision: A×B and B×A count as the same saved comparison.

The button:
- Is `disabled` when `saveComparison.isPending || alreadySaved`.
- Renders a filled `Bookmark` icon (`fill="currentColor"`) + "Already saved" text when `alreadySaved` is true and the transient `justSaved` state isn't active — same filled/disabled visual convention `FavoriteButton.jsx` already uses for its saved state.
- Keeps the existing `justSaved` "Saved" transient (2s) unchanged; once it clears, the button naturally settles into "Already saved" because the save mutation already invalidates the `["comparisons"]` query.

## Out of scope

- No backend/API changes — `GET /comparisons` already returns everything needed.
- No change to `ProfilePage.jsx` or existing saved comparisons (does not deduplicate rows that are already saved twice — only prevents new duplicates going forward).
