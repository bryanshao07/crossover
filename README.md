# CrossOver

## Project Name & Pitch

[![CI](https://github.com/bryanshao07/crossover/actions/workflows/ci.yml/badge.svg)](https://github.com/bryanshao07/crossover/actions/workflows/ci.yml)

> Don't know soccer? Find your player.

**CrossOver** is a cross-sport player similarity engine that projects 290 NBA players and 295 soccer
players into one seven-attribute space and ranks each player's closest counterparts in the other
sport, built with React (Vite) + Three.js on the front end, FastAPI + PostgreSQL on the back end,
and the Gemini API for semantic search and comparison explanations.

The similarity math is offline: `notebook/notebook.ipynb` scales the raw stat lines into seven
normalized attributes (scoring, playmaking, defensive_impact, efficiency, versatility,
physical_dominance, durability), computes the cosine similarity matrix and a 3D UMAP embedding, and
writes everything to `exports/`. Those files are committed, and `backend/data_store.py` loads them
once at process start — nothing is recomputed per request. On top of that sit a FastAPI service
(player/compare/universe/search endpoints, plus JWT cookie auth, saved comparisons and favorites in
Postgres) and a React SPA whose Universe page renders all 585 players as a single instanced
Three.js mesh.

## Project Status

Deployed live at **https://crossover-ten-theta.vercel.app/** — frontend on Vercel, API on Render.


The user-facing flows are complete and covered by 77 passing backend tests. What is still open:

- **Lint gates in CI are advisory, not blocking.** Both lint steps in `.github/workflows/ci.yml`
  carry `continue-on-error: true` with the note "ratchet to blocking once the tree is ruff-clean /
  eslint-clean". On a fresh clone of `main`, `ruff check . --exclude venv --exclude .venv --exclude
  alembic` reports 166 findings (113 auto-fixable) and `npm run lint` reports 4 errors and 1 warning
  (for example, an unused `useNavigate` import in `frontend/src/pages/UniversePage.jsx`).
- **CI verifies but does not deploy.** The pipeline runs pytest against a Postgres service, a
  `pip-audit` gate that fails on HIGH/CRITICAL advisories, and the frontend build. Deploys happen on
  Vercel and Render outside of it.
- **The notebook does not run end to end from a fresh clone.** `notebook/notebook.ipynb` reads
  `exports/nba-advanced-stats.csv` and `data/soccer-stats.csv`, but in the repo those files live at
  `data/nba-advanced-stats.csv` and `exports/soccer-stats.csv`. The app is unaffected — every
  artifact the notebook produces is already committed under `exports/`.
- **`next-app/` is an unused scaffold.** It is an unmodified Vite + React + TypeScript + shadcn/ui
  starter template; nothing in `frontend/`, `backend/`, or CI references it.

## Project Screenshots

![CrossOver universe view](docs/screenshots/universe.png)

![CrossOver comparison view](docs/screenshots/comparison.png)

Neither file is in the repo yet. To produce them, start both servers (see below), create the
directory, and capture the two views at roughly 1440×900:

```bash
mkdir -p docs/screenshots
```

1. `docs/screenshots/universe.png` — open http://localhost:5173/universe and let the intro
   animation settle so the left control panel is in place and the point cloud is fully rendered,
   then hover a point so the tooltip shows. Frame the whole viewport: control panel on the left, 3D
   scatter filling the rest.
2. `docs/screenshots/comparison.png` — open http://localhost:5173/compare, pick one NBA and one
   soccer player (for example Nikola Jokić and Kevin De Bruyne) to land on
   `/compare/Nikola%20Joki%C4%87/Kevin%20De%20Bruyne`. Frame the similarity score, both player
   columns, and the overlapping radar chart. The Gemini write-up is not on this page by default —
   it opens in a modal behind the "Generate explanation" button, so capture that separately if you
   want it shown.

## Installation and Setup Instructions

### Prerequisites

- **Python 3.11 or 3.12.** 3.11 is what CI uses and what these steps were verified against. Python
  3.13 does not work: `requirements.txt` pins `numpy==1.26.*`, which has no cp313 wheels and fails
  to build from source.
- **Node 20 or newer.** CI uses 20; verified locally on 24.13.
- **PostgreSQL 16**, reachable at whatever `DATABASE_URL` points to. Postgres backs accounts, saved
  comparisons, and favorites only — the player, compare, universe, search, and explain endpoints all
  read from `exports/` and work without a database, but every `/auth/*` write fails with a 500 if it
  is unreachable.

### 1. Database

Any Postgres 16 instance works. The default DSN in `backend/config.py` matches this container:

```bash
docker run -d --name crossover-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=crossover \
  -p 5432:5432 postgres:16
```

### 2. Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

`.env.example` ships `JWT_SECRET_KEY` empty. An empty value is accepted by the settings model but
would sign tokens with an empty key, so fill it in:

```bash
python -c "import secrets; print(secrets.token_hex(32))"   # paste into JWT_SECRET_KEY
```

Apply the migrations (run from `backend/` — `alembic/env.py` imports `config.py` and overrides
`sqlalchemy.url` with `DATABASE_URL`, so `alembic.ini` needs no editing):

```bash
alembic upgrade head
```

Start the API:

```bash
uvicorn main:app --reload --port 8000
```

The server does not bind immediately: `data_store.load()` reads the 6.8 MB similarity matrix, the
24 MB style-card embeddings, and both stat CSVs first, which takes a few seconds. Verify:

```bash
curl localhost:8000/health
# {"status":"ok","players":585}
```

Run the tests (they expect the database to be up; several auth tests hit it over a live connection):

```bash
pytest -q
# 77 passed
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app is served at http://localhost:5173. No frontend env file is needed for local development:
`src/api/client.js` defaults `VITE_API_BASE_URL` to `/api`, and `vite.config.js` proxies `/api` to
`http://localhost:8000`. To point the local UI at a deployed API instead, set
`VITE_API_BASE_URL=https://<your-api-host>` in `frontend/.env.local`.

### Backend environment variables

All are read by `backend/config.py` from `backend/.env` or the process environment.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET_KEY` | Yes | — | No default by design; if the key is entirely absent the app raises a pydantic `ValidationError` at startup rather than signing with a guessable value. |
| `DATABASE_URL` | No | `postgresql://postgres:postgres@localhost:5432/crossover` | A legacy `postgres://` scheme (what Render and Heroku hand out) is rewritten to `postgresql://` so platform URLs can be pasted in verbatim. |
| `ENVIRONMENT` | No | `production` | Fail-secure default. Local HTTP dev must set `development`, otherwise the auth cookie is issued `SameSite=None; Secure` and will not persist over `http://localhost`. |
| `GEMINI_API_KEY` | No | unset | Enables Gemini-written comparison bullets and semantic search. Without it the app still runs: `/explain` returns deterministic fallback bullets computed from the attribute vectors, and `?mode=semantic` search falls through to substring matching. |
| `CORS_ORIGINS` | No | `localhost:5173`, `127.0.0.1:5173`, the Vercel URL | JSON list; `main.py` reads it from settings. |
| `EXPORTS_DIR` | No | `<repo>/exports` | Where the precomputed ML artifacts are read from. |
| `UPLOADS_DIR` | No | `<repo>/uploads` | Avatar uploads; created at startup and mounted at `/static`. |

### Rebuilding the RAG assets (optional)

`exports/style_cards.json` and `exports/style_embeddings.json` are committed and already cover all
585 players, so this is only needed if the player set changes:

```bash
cd backend
python -m scripts.build_rag   # requires GEMINI_API_KEY; idempotent, only fills in missing players
```

The script backs off on rate limits, but a full rebuild against a free-tier Gemini key will spend a
long time in 429 retries.
