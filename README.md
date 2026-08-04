# CrossOver

## Project Name & Pitch

[![CI](https://github.com/bryanshao07/crossover/actions/workflows/ci.yml/badge.svg)](https://github.com/bryanshao07/crossover/actions/workflows/ci.yml)

> Don't know soccer? Find your player.

**CrossOver** is a cross-sport player similarity engine that projects 290 NBA players and 295 soccer
players into one seven-attribute space and ranks each player's closest counterparts in the other
sport, built with React (Vite) + Three.js on the front end, FastAPI + PostgreSQL on the back end,
and the Gemini API for semantic search and comparison explanations.

## Project Status

Deployed live at **https://crossover-ten-theta.vercel.app/** — frontend on Vercel, API on Render.


The user-facing flows are complete and covered by 77 passing backend tests. 


## Project Screenshots

**Homepage** — search with autocomplete over all 585 players, sport filter pills, and a Three.js
particle field behind the hero, with the top cross-sport comparisons carousel below.

![CrossOver homepage](docs/screenshots/homepage.png)

**Universe** — every player rendered as one instanced Three.js mesh, with sport filters, a color-by
selector, and click-through to a player profile.

![CrossOver universe view](docs/screenshots/universe.png)

**Comparison** — both players side by side with their seven attribute scores and DNA labels, the
similarity score and its percentile among all cross-sport pairs, and an overlapping radar chart.
The Gemini write-up opens in a modal behind "Generate explanation".

![CrossOver comparison view](docs/screenshots/comparison.png)

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
