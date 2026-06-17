# CrossOver — Architecture & File Structure Design

**Date:** 2026-06-17
**Status:** Approved

## Overview

CrossOver is a cross-sport NBA-to-soccer player similarity web app. It matches NBA
players to soccer equivalents via cosine similarity across 7 universal attributes. The
ML pipeline is already done; all data is precomputed in `exports/`. This spec covers the
**FastAPI backend** and **React frontend** that serve and visualize that data.

Nothing is recomputed at runtime except the Gemini `/explain` call.

## Decisions

- **Frontend tooling:** Vite + React (SPA, `react-router-dom`).
- **Backend layout:** Modular FastAPI — `main.py` + `data_store.py` + `routers/` + `services/`.
- **Data fetching:** TanStack Query (caching, loading/error states, dedup).
- **AI:** Google Gemini `gemini-2.5-flash` for `/explain` only.

## Data Realities (from `exports/`)

These shaped the design and must be handled in `data_store.py`:

- `player_index.json` — **list** of `{player, sport, position, dna}` (585 players).
- `player_vectors.json` — **dict** keyed by player name → 7 attrs (0–1 scaled) + `sport`. Use for radar.
- `umap_players.json` — list with `x/y/z` + raw (unscaled) attrs + `dominant_attr`, `dna`.
- `nba_pct.json` / `soccer_pct.json` — lists keyed by `Player` with `*_pct` columns (underlying stats).
- `quality_scores.json` — list of `{player, quality}`.
- `sim_matrix.csv` — 585×585 cosine similarity matrix; header row = player names, first col `Player`. Gitignored.

**Field naming:** files use `player`/`Player`; the API contract uses `name`. Normalization
happens **only** in `data_store.py` so the rest of the code stays clean.

## Backend (`backend/`)

```
backend/
├── main.py                # FastAPI app: CORS, includes routers, data_store.load() on startup
├── config.py              # pydantic-settings: GEMINI_API_KEY, EXPORTS_DIR, CORS origins (.env)
├── data_store.py          # Loads exports/ once into memory; normalizes player/Player→name; lookups
├── models.py              # Pydantic models: Player, UMAPPlayer, SimilarityMatch, CompareResult, Explanation
├── routers/
│   ├── __init__.py
│   ├── players.py         # GET /players · GET /player/{name} · GET /search
│   ├── compare.py         # GET /compare/{player_a}/{player_b}
│   ├── universe.py        # GET /universe
│   └── explain.py         # GET /explain/{player_a}/{player_b}
├── services/
│   ├── __init__.py
│   ├── similarity.py      # Top-N cross-sport matches; pair-percentile context (precomputed at startup)
│   └── gemini.py          # gemini-2.5-flash client; prompt from pct stats; returns bullet explanation
├── requirements.txt
├── .env.example           # GEMINI_API_KEY=
└── README.md              # uvicorn main:app --reload --port 8000
```

**Notes**
- `data_store.py` holds all in-memory state: indexes + `sim_matrix` as a pandas DataFrame indexed by name. Loaded once on startup.
- `similarity.py` precomputes the distribution of all cross-sport pair similarities at startup so `/compare` returns a percentile-rank context with no per-request recompute.
- `/player/{name}` returns top **10** opposite-sport matches; profile page shows top 5.
- CORS enabled for the Vite dev origin.

### API Endpoints
- `GET /players` — full player index for autocomplete.
- `GET /player/{name}` — vectors + dna + top 10 cross-sport matches.
- `GET /compare/{a}/{b}` — both vectors + similarity + percentile context + underlying pct stats.
- `GET /universe` — all UMAP coordinates + metadata.
- `GET /explain/{a}/{b}` — Gemini bullet explanation (slow; frontend shows skeleton).
- `GET /search?q=&sport=&position=` — filtered player list.

## Frontend (`frontend/`)

```
frontend/
├── index.html             # favicon=/logo.png; Inter + JetBrains Mono via Google Fonts
├── vite.config.js         # Vite + React; dev proxy /api → http://localhost:8000
├── tailwind.config.js     # tokens: bg #0a0a0f, accent #e8ff47, nba #4a7fff, soccer #39d353, radius 2-4px
├── postcss.config.js
├── package.json
├── .env.example           # VITE_API_BASE_URL=http://localhost:8000
├── public/logo.png        # copied from mockups/logo.png — favicon + nav logo
└── src/
    ├── main.jsx           # BrowserRouter + QueryClientProvider
    ├── App.jsx            # route table
    ├── index.css          # Tailwind directives, CSS vars, base styles
    ├── api/client.js      # axios instance + endpoint fns; URL-encodes player names
    ├── hooks/             # usePlayers, usePlayer, useCompare, useUniverse, useExplain, useSearch
    ├── lib/
    │   ├── format.js      # 0.91 → "91%"; name encode/decode
    │   └── attributes.js  # 7 attribute keys, ALL-CAPS labels, colors
    ├── components/
    │   ├── layout/        # NavBar, PageShell
    │   ├── ui/            # GlassPanel, SportBadge, DnaLabel, FilterPill, Avatar, Skeleton
    │   ├── shadcn/        # command.jsx (behavior only)
    │   ├── search/        # Autocomplete.jsx
    │   ├── charts/        # RadarChart, OverlapRadarChart (Recharts)
    │   ├── cards/         # MatchCard, PlayerCard
    │   └── universe/      # ParticleField, UniverseScene, PlayerPoints, HoverTooltip, ControlPanel
    └── pages/             # HomePage, PlayerProfilePage, ComparisonPage, UniversePage, SearchResultsPage
```

**Notes**
- **Mobile** (mockup #6) is a responsive adaptation of `PlayerProfilePage` via Tailwind breakpoints — not a separate route.
- **shadcn** is used once (`command.jsx`) for autocomplete behavior only; all visuals from `ui/` + Tailwind tokens. No MUI/Chakra/visual shadcn.
- Player names contain special characters (e.g. Nikola Jokić) — encode/decode carefully on both ends.
- Each page-building step begins by reading the matching mockup in `mockups/`.

### Routes
`/` Home · `/player/:name` Profile · `/compare/:a/:b` Comparison · `/universe` Universe · `/search` Results.

## Build Order (incremental, verify as we go)

1. Backend: scaffold + `data_store` + models, then endpoints. Verify each via curl.
2. Frontend scaffold: Vite + Tailwind tokens + NavBar + routing shell + logo.
3. Pages in mockup order: Home → Player Profile → Comparison → Search Results → Universe → mobile polish.
4. Commit each working feature incrementally.

## Out of Scope (per CLAUDE.md)

- Player photos (use sport-colored avatars).
- Quality-score filtering (future feature).
- Recomputing similarity / UMAP at runtime.
- Modifying `notebook/`.
