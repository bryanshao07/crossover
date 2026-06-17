# CrossOver — CLAUDE.md

## Project Overview

CrossOver is a cross-sport NBA-to-soccer player similarity web app. It matches NBA players to their soccer equivalents using cosine similarity across 7 universal attributes (scoring, playmaking, defensive_impact, efficiency, versatility, physical_dominance, durability). The ML pipeline lives in the notebook, the precomputed data lives in exports/, and the web app is a FastAPI backend + React frontend.

## Repo Structure

crossover/
├── mockups/ # UI reference mockups + logo — source of truth for all design decisions
├── exports/ # precomputed ML data — never recompute at runtime
├── notebook/ # Jupyter ML pipeline — crossover_pipeline.ipynb
├── backend/ # FastAPI Python backend
└── frontend/ # React frontend

## Tech Stack

- **Backend**: FastAPI (Python), loaded from exports/ at startup
- **Frontend**: React + Tailwind CSS + React Three Fiber + Framer Motion + Recharts
- **AI**: Google Gemini API (gemini-2.5-flash) for player comparison explanations
- **Routing**: react-router-dom
- **Component behavior only**: shadcn/ui (no visual styling from it)

## Design System — Follow Exactly

- Background: `#0a0a0f`
- Primary accent: `#e8ff47` (electric yellow-green)
- NBA color: `#4a7fff` (cool blue)
- Soccer color: `#39d353` (fresh green)
- Fonts: Inter (UI text), JetBrains Mono (numbers/stats) — both via Google Fonts
- Border radius: 2-4px max — sharp edges only, no pill buttons
- Surfaces: glass panels with 1px borders and subtle background blur
- No MUI, Chakra, or any visual component library — build from scratch with Tailwind

## Data Structures

```typescript
Player {
  name: string
  sport: "basketball" | "soccer"
  position: string           // e.g. "PG", "MF", "DF"
  dna: string                // e.g. "Elite Versatility · Elite Playmaking"
  scoring: float             // 0-1, min-max scaled attribute score
  playmaking: float
  defensive_impact: float
  efficiency: float
  versatility: float
  physical_dominance: float
  durability: float
}

UMAPPlayer extends Player {
  x: float                   // Three.js position coordinate — use directly
  y: float
  z: float
  dominant_attr: string
}

SimilarityMatch {
  player: string
  sport: string
  similarity: float          // 0-1, display as percentage
  quality: float
}
```

## API Endpoints

- `GET /players` — all players for autocomplete
- `GET /player/{name}` — player data + top 10 cross-sport matches
- `GET /compare/{player_a}/{player_b}` — both players + similarity score + context + percentile stats
- `GET /universe` — all UMAP coordinates + metadata
- `GET /explain/{player_a}/{player_b}` — Gemini bullet explanation (slow — show loading state)
- `GET /search?q={query}&sport={sport}&position={position}` — filtered search

## Key Conventions

- Player names have special characters (e.g. Nikola Jokić) — always URL encode/decode carefully
- sim_matrix.csv loads once at startup — never reload per request
- All similarity scores display as percentages (0.91 → "91%")
- Sport badges: blue pill "NBA" or green pill "SOCCER"
- DNA labels display in `#e8ff47` accent color
- Attribute names display in ALL CAPS monospace
- Loading state for /explain endpoint — skeleton UI, not a spinner
- Player photos not implemented yet — use sport-colored circular avatars

## Pages

1. **Homepage** — Three.js particle universe background, centered search + autocomplete, sport filter pills, featured comparison cards bottom right
2. **Player Profile** — DNA label, radar chart, top 5 match cards
3. **Comparison** — side by side columns, overlapping radar chart, similarity score, Gemini explanation
4. **Universe** — full screen React Three Fiber 3D scatter, left control panel, hover tooltip, click to profile
5. **Search Results** — filter pills, 3-column card grid, pagination
6. **Mobile** — responsive Player Profile adaptation

## Mockups

Always read the relevant mockup image in mockups/ before building any component. The mockups are the source of truth for layout and visual hierarchy. Logo is at mockups/logo.png — copy to frontend/public/logo.png for use as favicon and nav logo.

## Workflow Preferences

- Always propose before implementing on any task that touches more than one file
- Never modify notebook/ files unless explicitly asked
- Never recompute similarity scores or UMAP coordinates at runtime — everything is in exports/
- Commit working features incrementally — don't build everything before testing
- Run the backend from backend/ and frontend from frontend/ in separate terminals
