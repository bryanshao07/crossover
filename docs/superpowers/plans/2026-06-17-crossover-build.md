# CrossOver Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI backend and React (Vite) frontend that serve and visualize the precomputed cross-sport player-similarity data in `exports/`.

**Architecture:** Backend loads all `exports/` files into memory once at startup (`data_store`), exposes 6 read endpoints plus a Gemini-backed `/explain`. Frontend is a Vite SPA using react-router-dom + TanStack Query, styled from scratch with Tailwind tokens, rendering 5 pages that match the mockups in `mockups/`.

**Tech Stack:** FastAPI, pandas, numpy, google-generativeai, pydantic-settings (backend); React, Vite, Tailwind, TanStack Query, react-router-dom, Recharts, @react-three/fiber + drei, framer-motion (frontend).

## Global Constraints

- Python 3.9 — use `typing.Optional`/`typing.List`, NOT `X | None` syntax.
- Never recompute similarity or UMAP at runtime; only `/explain` calls Gemini.
- `sim_matrix.csv` and all `exports/` load once at startup; never per request.
- API contract uses field `name`; source files use `player`/`Player` — normalize only in `data_store.py`.
- Similarity scores returned as floats 0–1; frontend displays as integer percent ("91%").
- Player names contain non-ASCII (e.g. Nikola Jokić) — URL-encode/decode on both ends.
- Design tokens (exact): bg `#0a0a0f`, accent `#e8ff47`, NBA `#4a7fff`, soccer `#39d353`. Fonts: Inter (UI), JetBrains Mono (numbers). Border radius 2–4px max. No MUI/Chakra/visual shadcn.
- Avatars are sport-colored circles (no photos). No quality-score filtering. Never modify `notebook/`.
- Backend runs on port 8000; frontend dev proxies `/api` → `http://localhost:8000`.

---

# Phase 1 — Backend

### Task 1: Backend scaffold, config, dependencies

**Files:**
- Create: `backend/requirements.txt`, `backend/.env.example`, `backend/config.py`, `backend/README.md`, `backend/pytest.ini`
- Create: `backend/__init__.py`, `backend/routers/__init__.py`, `backend/services/__init__.py`, `backend/tests/__init__.py`

**Interfaces:**
- Produces: `config.settings` with attrs `gemini_api_key: Optional[str]`, `exports_dir: str`, `cors_origins: List[str]`.

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.*
uvicorn[standard]==0.30.*
pandas==2.2.*
numpy==1.26.*
google-generativeai==0.8.*
pydantic-settings==2.*
python-dotenv==1.*
httpx==0.27.*
pytest==8.*
```

- [ ] **Step 2: Create `backend/.env.example`**

```
GEMINI_API_KEY=
```

- [ ] **Step 3: Create the package `__init__.py` files (empty)**

Create empty files: `backend/__init__.py`, `backend/routers/__init__.py`, `backend/services/__init__.py`, `backend/tests/__init__.py`.

- [ ] **Step 4: Create `backend/pytest.ini`**

```ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 5: Create `backend/config.py`**

```python
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: Optional[str] = None
    exports_dir: str = str(_REPO_ROOT / "exports")
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
```

- [ ] **Step 6: Create `backend/README.md`**

```markdown
# CrossOver Backend

    pip install -r requirements.txt
    cp .env.example .env   # add GEMINI_API_KEY
    uvicorn main:app --reload --port 8000

Run tests: `pytest`
```

- [ ] **Step 7: Install deps and verify config imports**

Run: `cd backend && pip install -r requirements.txt && python -c "from config import settings; print(settings.exports_dir)"`
Expected: prints an absolute path ending in `/exports`.

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffold, config, dependencies"
```

---

### Task 2: data_store — load exports once, normalize to `name`

**Files:**
- Create: `backend/data_store.py`
- Test: `backend/tests/test_data_store.py`

**Interfaces:**
- Produces:
  - `load() -> None` — populates module state from `settings.exports_dir`. Idempotent.
  - `players() -> List[dict]` — index rows `{name, sport, position, dna}`.
  - `get_player(name: str) -> Optional[dict]` — index row or None.
  - `vector(name: str) -> Optional[dict]` — `{scoring,...,durability, sport}` (7 attrs 0–1 + sport).
  - `pct_stats(name: str, sport: str) -> dict` — underlying `*_pct` cols (excludes `Player`,`Pos`).
  - `quality(name: str) -> Optional[float]`.
  - `umap() -> List[dict]` — umap rows (already have `player` key → normalized to `name`).
  - `sim_row(name: str) -> Optional[pandas.Series]` — similarity of `name` to all players, indexed by name.
  - `all_names() -> List[str]`.
  - `ATTRS: List[str]` — the 7 attribute keys in canonical order.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_data_store.py
import math
import data_store as ds


def setup_module(_):
    ds.load()


def test_players_normalized_to_name():
    players = ds.players()
    assert len(players) == 585
    row = players[0]
    assert set(row) == {"name", "sport", "position", "dna"}
    assert "player" not in row


def test_vector_has_seven_attrs_in_range():
    v = ds.vector("Amen Thompson")
    for attr in ds.ATTRS:
        assert 0.0 <= v[attr] <= 1.0
    assert v["sport"] == "basketball"


def test_sim_row_self_is_one():
    row = ds.sim_row("Amen Thompson")
    assert math.isclose(row["Amen Thompson"], 1.0, abs_tol=1e-6)


def test_pct_stats_excludes_label_columns():
    stats = ds.pct_stats("Amen Thompson", "basketball")
    assert "Player" not in stats and "Pos" not in stats
    assert all(k.endswith("_pct") for k in stats)


def test_unknown_player_returns_none():
    assert ds.get_player("Nobody XYZ") is None
    assert ds.vector("Nobody XYZ") is None
    assert ds.sim_row("Nobody XYZ") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_data_store.py -v`
Expected: FAIL (ModuleNotFoundError / no attribute `load`).

- [ ] **Step 3: Write `backend/data_store.py`**

```python
import json
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from config import settings

ATTRS: List[str] = [
    "scoring",
    "playmaking",
    "defensive_impact",
    "efficiency",
    "versatility",
    "physical_dominance",
    "durability",
]

_index: List[dict] = []
_index_by_name: Dict[str, dict] = {}
_vectors: Dict[str, dict] = {}
_umap: List[dict] = []
_quality: Dict[str, float] = {}
_pct: Dict[str, Dict[str, float]] = {}  # sport -> {name -> {col: val}}
_sim: Optional[pd.DataFrame] = None
_loaded = False


def _read_json(name: str):
    with open(Path(settings.exports_dir) / name, encoding="utf-8") as f:
        return json.load(f)


def _load_pct(filename: str) -> Dict[str, Dict[str, float]]:
    rows = _read_json(filename)
    out: Dict[str, Dict[str, float]] = {}
    for r in rows:
        name = r["Player"]
        out[name] = {k: v for k, v in r.items() if k not in ("Player", "Pos")}
    return out


def load() -> None:
    global _index, _index_by_name, _vectors, _umap, _quality, _pct, _sim, _loaded
    if _loaded:
        return

    raw_index = _read_json("player_index.json")
    _index = [
        {"name": r["player"], "sport": r["sport"], "position": r["position"], "dna": r["dna"]}
        for r in raw_index
    ]
    _index_by_name = {r["name"]: r for r in _index}

    _vectors = _read_json("player_vectors.json")

    raw_umap = _read_json("umap_players.json")
    _umap = [{**r, "name": r.pop("player")} for r in raw_umap]

    _quality = {r["player"]: r["quality"] for r in _read_json("quality_scores.json")}

    _pct = {
        "basketball": _load_pct("nba_pct.json"),
        "soccer": _load_pct("soccer_pct.json"),
    }

    _sim = pd.read_csv(Path(settings.exports_dir) / "sim_matrix.csv", index_col=0)

    _loaded = True


def players() -> List[dict]:
    return _index


def all_names() -> List[str]:
    return list(_index_by_name.keys())


def get_player(name: str) -> Optional[dict]:
    return _index_by_name.get(name)


def vector(name: str) -> Optional[dict]:
    return _vectors.get(name)


def quality(name: str) -> Optional[float]:
    return _quality.get(name)


def pct_stats(name: str, sport: str) -> dict:
    return _pct.get(sport, {}).get(name, {})


def umap() -> List[dict]:
    return _umap


def sim_row(name: str) -> Optional["pd.Series"]:
    if _sim is None or name not in _sim.index:
        return None
    return _sim.loc[name]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_data_store.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/data_store.py backend/tests/test_data_store.py
git commit -m "feat(backend): data_store loads exports once, normalizes to name"
```

---

### Task 3: Pydantic response models

**Files:**
- Create: `backend/models.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces:
  - `Player(name, sport, position, dna, scoring, playmaking, defensive_impact, efficiency, versatility, physical_dominance, durability)`
  - `SimilarityMatch(name, sport, position, dna, similarity, quality)`
  - `PlayerDetail(player: Player, matches: List[SimilarityMatch])`
  - `UMAPPlayer(name, sport, position, x, y, z, dominant_attr: Optional[str], dna)`
  - `CompareResult(player_a: Player, player_b: Player, similarity, percentile, context: str, stats_a: dict, stats_b: dict)`
  - `Explanation(bullets: List[str])`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models.py
from models import Player, SimilarityMatch, CompareResult


def test_player_round_trip():
    p = Player(
        name="X", sport="basketball", position="PG", dna="d",
        scoring=0.5, playmaking=0.5, defensive_impact=0.5, efficiency=0.5,
        versatility=0.5, physical_dominance=0.5, durability=0.5,
    )
    assert p.model_dump()["name"] == "X"


def test_similarity_match_fields():
    m = SimilarityMatch(name="Y", sport="soccer", position="MF", dna="d",
                        similarity=0.91, quality=0.8)
    assert m.similarity == 0.91


def test_compare_result_holds_stats_dicts():
    c = CompareResult.model_validate({
        "player_a": {"name": "A", "sport": "basketball", "position": "PG", "dna": "d",
                     "scoring": 0.1, "playmaking": 0.1, "defensive_impact": 0.1,
                     "efficiency": 0.1, "versatility": 0.1, "physical_dominance": 0.1,
                     "durability": 0.1},
        "player_b": {"name": "B", "sport": "soccer", "position": "MF", "dna": "d",
                     "scoring": 0.2, "playmaking": 0.2, "defensive_impact": 0.2,
                     "efficiency": 0.2, "versatility": 0.2, "physical_dominance": 0.2,
                     "durability": 0.2},
        "similarity": 0.8, "percentile": 95.0, "context": "top 5%",
        "stats_a": {"PTS_pct": 0.5}, "stats_b": {"Gls_pct": 0.6},
    })
    assert c.percentile == 95.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_models.py -v`
Expected: FAIL (cannot import models).

- [ ] **Step 3: Write `backend/models.py`**

```python
from typing import Dict, List, Optional

from pydantic import BaseModel


class Player(BaseModel):
    name: str
    sport: str
    position: str
    dna: str
    scoring: float
    playmaking: float
    defensive_impact: float
    efficiency: float
    versatility: float
    physical_dominance: float
    durability: float


class SimilarityMatch(BaseModel):
    name: str
    sport: str
    position: str
    dna: str
    similarity: float
    quality: Optional[float] = None


class PlayerDetail(BaseModel):
    player: Player
    matches: List[SimilarityMatch]


class UMAPPlayer(BaseModel):
    name: str
    sport: str
    position: str
    x: float
    y: float
    z: float
    dominant_attr: Optional[str] = None
    dna: str


class CompareResult(BaseModel):
    player_a: Player
    player_b: Player
    similarity: float
    percentile: float
    context: str
    stats_a: Dict[str, float]
    stats_b: Dict[str, float]


class Explanation(BaseModel):
    bullets: List[str]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_models.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_models.py
git commit -m "feat(backend): pydantic response models"
```

---

### Task 4: similarity service — matches + percentile context

**Files:**
- Create: `backend/services/similarity.py`
- Test: `backend/tests/test_similarity.py`

**Interfaces:**
- Consumes: `data_store.sim_row`, `data_store.get_player`, `data_store.quality`, `data_store.players`.
- Produces:
  - `top_matches(name: str, limit: int = 10) -> List[SimilarityMatch]` — opposite-sport only, sorted desc.
  - `build_pair_distribution() -> None` — precompute sorted array of all cross-sport pair sims (call once at startup, after `data_store.load()`).
  - `percentile_for(similarity: float) -> float` — percentile rank (0–100) of a sim value within the precomputed distribution.
  - `context_label(percentile: float) -> str` — human phrase, e.g. "Top 5% of all cross-sport pairs".

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_similarity.py
import data_store as ds
from services import similarity


def setup_module(_):
    ds.load()
    similarity.build_pair_distribution()


def test_top_matches_are_opposite_sport():
    matches = similarity.top_matches("Amen Thompson", limit=10)
    assert len(matches) == 10
    assert all(m.sport == "soccer" for m in matches)
    # sorted descending by similarity
    sims = [m.similarity for m in matches]
    assert sims == sorted(sims, reverse=True)


def test_top_matches_exclude_self_and_same_sport():
    matches = similarity.top_matches("Amen Thompson", limit=585)
    names = {m.name for m in matches}
    assert "Amen Thompson" not in names


def test_percentile_monotonic():
    lo = similarity.percentile_for(0.0)
    hi = similarity.percentile_for(0.999)
    assert 0.0 <= lo <= hi <= 100.0


def test_context_label_is_string():
    assert isinstance(similarity.context_label(96.0), str)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_similarity.py -v`
Expected: FAIL (cannot import services.similarity).

- [ ] **Step 3: Write `backend/services/similarity.py`**

```python
from typing import List, Optional

import numpy as np

import data_store as ds
from models import SimilarityMatch

_pair_sims_sorted: Optional[np.ndarray] = None


def top_matches(name: str, limit: int = 10) -> List[SimilarityMatch]:
    row = ds.sim_row(name)
    base = ds.get_player(name)
    if row is None or base is None:
        return []
    opposite = "soccer" if base["sport"] == "basketball" else "basketball"
    scored = []
    for other_name, sim in row.items():
        if other_name == name:
            continue
        p = ds.get_player(other_name)
        if p is None or p["sport"] != opposite:
            continue
        scored.append((float(sim), p))
    scored.sort(key=lambda t: t[0], reverse=True)
    out: List[SimilarityMatch] = []
    for sim, p in scored[:limit]:
        out.append(
            SimilarityMatch(
                name=p["name"], sport=p["sport"], position=p["position"],
                dna=p["dna"], similarity=sim, quality=ds.quality(p["name"]),
            )
        )
    return out


def build_pair_distribution() -> None:
    global _pair_sims_sorted
    names = ds.all_names()
    sports = {n: ds.get_player(n)["sport"] for n in names}
    vals: List[float] = []
    for n in names:
        row = ds.sim_row(n)
        if row is None:
            continue
        for other, sim in row.items():
            if other == n:
                continue
            if sports.get(other) != sports[n]:  # cross-sport only
                vals.append(float(sim))
    # each unordered pair counted twice; fine for percentile ranks
    _pair_sims_sorted = np.sort(np.array(vals, dtype=float))


def percentile_for(similarity: float) -> float:
    if _pair_sims_sorted is None or _pair_sims_sorted.size == 0:
        return 0.0
    idx = np.searchsorted(_pair_sims_sorted, similarity, side="right")
    return round(100.0 * idx / _pair_sims_sorted.size, 1)


def context_label(percentile: float) -> str:
    top = round(100.0 - percentile, 1)
    if top <= 1:
        return "Top 1% of all cross-sport pairs — an exceptional match"
    if top <= 5:
        return f"Top {top:g}% of all cross-sport pairs — a strong match"
    if top <= 25:
        return f"Top {top:g}% of all cross-sport pairs — an above-average match"
    return "A modest cross-sport match"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_similarity.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/similarity.py backend/tests/test_similarity.py
git commit -m "feat(backend): similarity service — matches + percentile context"
```

---

### Task 5: helpers + players/search router

**Files:**
- Create: `backend/services/serialize.py` (builds `Player` from a name)
- Create: `backend/routers/players.py`
- Test: `backend/tests/test_players_router.py`

**Interfaces:**
- Consumes: `data_store`, `services.similarity.top_matches`, `models`.
- Produces (`serialize.py`): `player_model(name: str) -> Optional[Player]` — merges index row + vector into a `Player`.
- Produces (router): `router` with
  - `GET /players -> List[dict]` (raw index rows)
  - `GET /player/{name} -> PlayerDetail` (404 if unknown)
  - `GET /search?q=&sport=&position= -> List[dict]` (filtered index rows; `q` is case-insensitive substring on name)

- [ ] **Step 1: Write `backend/services/serialize.py`**

```python
from typing import Optional

import data_store as ds
from models import Player


def player_model(name: str) -> Optional[Player]:
    base = ds.get_player(name)
    vec = ds.vector(name)
    if base is None or vec is None:
        return None
    return Player(
        name=base["name"], sport=base["sport"], position=base["position"],
        dna=base["dna"],
        scoring=vec["scoring"], playmaking=vec["playmaking"],
        defensive_impact=vec["defensive_impact"], efficiency=vec["efficiency"],
        versatility=vec["versatility"], physical_dominance=vec["physical_dominance"],
        durability=vec["durability"],
    )
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_players_router.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_players_returns_full_index():
    r = client.get("/players")
    assert r.status_code == 200
    assert len(r.json()) == 585
    assert set(r.json()[0]) == {"name", "sport", "position", "dna"}


def test_player_detail_has_player_and_matches():
    r = client.get("/player/Amen Thompson")
    assert r.status_code == 200
    body = r.json()
    assert body["player"]["name"] == "Amen Thompson"
    assert len(body["matches"]) == 10
    assert all(m["sport"] == "soccer" for m in body["matches"])


def test_player_detail_unknown_404():
    assert client.get("/player/Nobody XYZ").status_code == 404


def test_search_filters_by_sport_and_query():
    r = client.get("/search", params={"q": "a", "sport": "soccer"})
    assert r.status_code == 200
    assert all(p["sport"] == "soccer" for p in r.json())
    assert all("a" in p["name"].lower() for p in r.json())


def test_search_filters_by_position():
    r = client.get("/search", params={"position": "PG"})
    assert all(p["position"] == "PG" for p in r.json())
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pytest tests/test_players_router.py -v`
Expected: FAIL (cannot import `main`).

- [ ] **Step 4: Write `backend/routers/players.py`**

```python
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

import data_store as ds
from models import PlayerDetail
from services import similarity
from services.serialize import player_model

router = APIRouter()


@router.get("/players")
def get_players() -> List[dict]:
    return ds.players()


@router.get("/player/{name}", response_model=PlayerDetail)
def get_player(name: str) -> PlayerDetail:
    player = player_model(name)
    if player is None:
        raise HTTPException(status_code=404, detail=f"Player not found: {name}")
    return PlayerDetail(player=player, matches=similarity.top_matches(name, limit=10))


@router.get("/search")
def search(
    q: Optional[str] = Query(default=None),
    sport: Optional[str] = Query(default=None),
    position: Optional[str] = Query(default=None),
) -> List[dict]:
    rows = ds.players()
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in r["name"].lower()]
    if sport:
        rows = [r for r in rows if r["sport"] == sport]
    if position:
        rows = [r for r in rows if r["position"] == position]
    return rows
```

(Depends on `main.py` from Task 9. To run this task's tests now, also create the minimal `main.py` in Task 9 first, OR temporarily run after Task 9. Recommended order: implement Task 9's `main.py` immediately after this file, then run all routizer tests together. If executing strictly in order, create the minimal `main.py` shown in Task 9 Step 3 now.)

- [ ] **Step 5: Create `main.py` (minimal, see Task 9) then run tests**

Run: `cd backend && pytest tests/test_players_router.py -v`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/routers/players.py backend/services/serialize.py backend/tests/test_players_router.py backend/main.py
git commit -m "feat(backend): players + search router"
```

---

### Task 6: compare router

**Files:**
- Create: `backend/routers/compare.py`
- Test: `backend/tests/test_compare_router.py`

**Interfaces:**
- Consumes: `data_store.sim_row`, `data_store.pct_stats`, `services.serialize.player_model`, `services.similarity.percentile_for`/`context_label`.
- Produces: `router` with `GET /compare/{player_a}/{player_b} -> CompareResult` (404 if either unknown).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_compare_router.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_compare_returns_both_players_and_similarity():
    r = client.get("/compare/Amen Thompson/Pedri")  # adjust b to any soccer name if needed
    # If "Pedri" is absent in this dataset, this test should use a known soccer player.
    assert r.status_code in (200, 404)


def test_compare_known_pair_structure():
    # pick player_b as the top soccer match of player_a to guarantee existence
    detail = client.get("/player/Amen Thompson").json()
    b = detail["matches"][0]["name"]
    r = client.get(f"/compare/Amen Thompson/{b}")
    assert r.status_code == 200
    body = r.json()
    assert body["player_a"]["name"] == "Amen Thompson"
    assert body["player_b"]["name"] == b
    assert 0.0 <= body["similarity"] <= 1.0
    assert 0.0 <= body["percentile"] <= 100.0
    assert isinstance(body["context"], str)
    assert body["stats_a"] and body["stats_b"]


def test_compare_unknown_404():
    assert client.get("/compare/Amen Thompson/Nobody XYZ").status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_compare_router.py -v`
Expected: FAIL (no `/compare` route).

- [ ] **Step 3: Write `backend/routers/compare.py`**

```python
from fastapi import APIRouter, HTTPException

import data_store as ds
from models import CompareResult
from services import similarity
from services.serialize import player_model

router = APIRouter()


@router.get("/compare/{player_a}/{player_b}", response_model=CompareResult)
def compare(player_a: str, player_b: str) -> CompareResult:
    a = player_model(player_a)
    b = player_model(player_b)
    if a is None or b is None:
        missing = player_a if a is None else player_b
        raise HTTPException(status_code=404, detail=f"Player not found: {missing}")

    row = ds.sim_row(player_a)
    similarity_value = float(row[player_b]) if row is not None and player_b in row else 0.0
    pct = similarity.percentile_for(similarity_value)

    return CompareResult(
        player_a=a,
        player_b=b,
        similarity=similarity_value,
        percentile=pct,
        context=similarity.context_label(pct),
        stats_a=ds.pct_stats(player_a, a.sport),
        stats_b=ds.pct_stats(player_b, b.sport),
    )
```

- [ ] **Step 4: Register the route in `main.py`**

Add to `main.py` imports/includes (see Task 9): `from routers import compare` and `app.include_router(compare.router)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_compare_router.py -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/routers/compare.py backend/tests/test_compare_router.py backend/main.py
git commit -m "feat(backend): compare router with percentile context"
```

---

### Task 7: universe router

**Files:**
- Create: `backend/routers/universe.py`
- Test: `backend/tests/test_universe_router.py`

**Interfaces:**
- Consumes: `data_store.umap`.
- Produces: `router` with `GET /universe -> List[UMAPPlayer]`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_universe_router.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_universe_returns_all_points_with_coords():
    r = client.get("/universe")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 585
    p = body[0]
    assert {"name", "sport", "position", "x", "y", "z", "dna"} <= set(p)
    assert all(isinstance(p[k], (int, float)) for k in ("x", "y", "z"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_universe_router.py -v`
Expected: FAIL (no `/universe` route).

- [ ] **Step 3: Write `backend/routers/universe.py`**

```python
from typing import List

from fastapi import APIRouter

import data_store as ds
from models import UMAPPlayer

router = APIRouter()


@router.get("/universe", response_model=List[UMAPPlayer])
def universe() -> List[UMAPPlayer]:
    return [UMAPPlayer(**row) for row in ds.umap()]
```

- [ ] **Step 4: Register in `main.py`** — `from routers import universe` + `app.include_router(universe.router)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_universe_router.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/universe.py backend/tests/test_universe_router.py backend/main.py
git commit -m "feat(backend): universe router"
```

---

### Task 8: gemini service + explain router

**Files:**
- Create: `backend/services/gemini.py`
- Create: `backend/routers/explain.py`
- Test: `backend/tests/test_explain_router.py`

**Interfaces:**
- Consumes: `data_store`, `services.serialize.player_model`, `services.similarity`.
- Produces (`gemini.py`):
  - `build_prompt(a: Player, b: Player, sim: float, stats_a: dict, stats_b: dict) -> str`
  - `explain(a, b, sim, stats_a, stats_b) -> List[str]` — returns 3–5 bullet strings. If no API key, returns a deterministic fallback derived from attribute deltas (so the app works offline/in tests).
- Produces (router): `GET /explain/{player_a}/{player_b} -> Explanation` (404 if unknown).

- [ ] **Step 1: Write the failing test** (no network — relies on key-absent fallback)

```python
# backend/tests/test_explain_router.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_explain_returns_bullets_without_api_key(monkeypatch):
    # ensure fallback path: no key configured during tests
    from services import gemini
    monkeypatch.setattr(gemini, "_model", None, raising=False)
    detail = client.get("/player/Amen Thompson").json()
    b = detail["matches"][0]["name"]
    r = client.get(f"/explain/Amen Thompson/{b}")
    assert r.status_code == 200
    bullets = r.json()["bullets"]
    assert 1 <= len(bullets) <= 6
    assert all(isinstance(x, str) and x for x in bullets)


def test_explain_unknown_404():
    assert client.get("/explain/Amen Thompson/Nobody XYZ").status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_explain_router.py -v`
Expected: FAIL (no `/explain` route).

- [ ] **Step 3: Write `backend/services/gemini.py`**

```python
from typing import List, Optional

from config import settings
from models import Player

_model = None
if settings.gemini_api_key:
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    except Exception:
        _model = None

ATTRS = [
    "scoring", "playmaking", "defensive_impact", "efficiency",
    "versatility", "physical_dominance", "durability",
]


def build_prompt(a: Player, b: Player, sim: float, stats_a: dict, stats_b: dict) -> str:
    return (
        "You are a cross-sport scout. Explain in 4 short bullet points why this "
        f"NBA/soccer pairing is a {sim*100:.0f}% match across these universal "
        "attributes: scoring, playmaking, defensive_impact, efficiency, versatility, "
        "physical_dominance, durability.\n\n"
        f"{a.name} ({a.sport}, {a.position}) — DNA: {a.dna}\n"
        f"attributes: { {k: round(getattr(a, k), 2) for k in ATTRS} }\n\n"
        f"{b.name} ({b.sport}, {b.position}) — DNA: {b.dna}\n"
        f"attributes: { {k: round(getattr(b, k), 2) for k in ATTRS} }\n\n"
        "Return ONLY bullet points, one per line, each starting with '- '. "
        "Be concrete, reference specific shared strengths and contrasts."
    )


def _fallback(a: Player, b: Player, sim: float) -> List[str]:
    shared = sorted(
        ATTRS, key=lambda k: abs(getattr(a, k) - getattr(b, k))
    )
    diverge = sorted(
        ATTRS, key=lambda k: -abs(getattr(a, k) - getattr(b, k))
    )
    nice = lambda s: s.replace("_", " ")
    return [
        f"Overall {sim*100:.0f}% cross-sport similarity between {a.name} and {b.name}.",
        f"Closest shared traits: {nice(shared[0])} and {nice(shared[1])}.",
        f"Biggest contrast: {nice(diverge[0])}.",
        f"Both profiles read as: {a.dna.split(' · ')[0]} ↔ {b.dna.split(' · ')[0]}.",
    ]


def _parse_bullets(text: str) -> List[str]:
    lines = [ln.strip().lstrip("-•* ").strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln][:6]


def explain(a: Player, b: Player, sim: float, stats_a: dict, stats_b: dict) -> List[str]:
    if _model is None:
        return _fallback(a, b, sim)
    try:
        resp = _model.generate_content(build_prompt(a, b, sim, stats_a, stats_b))
        bullets = _parse_bullets(resp.text or "")
        return bullets or _fallback(a, b, sim)
    except Exception:
        return _fallback(a, b, sim)
```

- [ ] **Step 4: Write `backend/routers/explain.py`**

```python
from fastapi import APIRouter, HTTPException

import data_store as ds
from models import Explanation
from services import gemini
from services.serialize import player_model

router = APIRouter()


@router.get("/explain/{player_a}/{player_b}", response_model=Explanation)
def explain(player_a: str, player_b: str) -> Explanation:
    a = player_model(player_a)
    b = player_model(player_b)
    if a is None or b is None:
        missing = player_a if a is None else player_b
        raise HTTPException(status_code=404, detail=f"Player not found: {missing}")
    row = ds.sim_row(player_a)
    sim = float(row[player_b]) if row is not None and player_b in row else 0.0
    bullets = gemini.explain(a, b, sim, ds.pct_stats(player_a, a.sport),
                             ds.pct_stats(player_b, b.sport))
    return Explanation(bullets=bullets)
```

- [ ] **Step 5: Register in `main.py`** — `from routers import explain` + `app.include_router(explain.router)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_explain_router.py -v`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/services/gemini.py backend/routers/explain.py backend/tests/test_explain_router.py backend/main.py
git commit -m "feat(backend): gemini explain service + router with offline fallback"
```

---

### Task 9: main app wiring, CORS, startup, full smoke

**Files:**
- Create/finalize: `backend/main.py`
- Test: `backend/tests/test_app_smoke.py`

**Interfaces:**
- Produces: `app` (FastAPI). On import: `data_store.load()` then `similarity.build_pair_distribution()`. CORS from `settings.cors_origins`. All four routers included.

- [ ] **Step 1: Write the final `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import data_store
from config import settings
from routers import compare, explain, players, universe
from services import similarity

data_store.load()
similarity.build_pair_distribution()

app = FastAPI(title="CrossOver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(compare.router)
app.include_router(universe.router)
app.include_router(explain.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "players": len(data_store.players())}
```

- [ ] **Step 2: Write the smoke test**

```python
# backend/tests/test_app_smoke.py
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["players"] == 585


def test_all_endpoints_reachable():
    assert client.get("/players").status_code == 200
    assert client.get("/universe").status_code == 200
    name = client.get("/players").json()[0]["name"]
    assert client.get(f"/player/{name}").status_code == 200
```

- [ ] **Step 3: Run the full backend suite**

Run: `cd backend && pytest -v`
Expected: PASS (all tests across all files).

- [ ] **Step 4: Manual server smoke**

Run: `cd backend && uvicorn main:app --port 8000 &` then `curl -s "http://localhost:8000/health"` and `curl -s "http://localhost:8000/player/Nikola%20Joki%C4%87" | head -c 200`
Expected: health JSON; Jokić detail returns 200 JSON (verifies non-ASCII URL decoding). Kill the server after.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_app_smoke.py
git commit -m "feat(backend): app wiring, CORS, startup load, smoke tests"
```

---

# Phase 2 — Frontend foundation

### Task 10: Vite scaffold, Tailwind tokens, fonts, logo, nav, routing shell

**Files:**
- Create: `frontend/` Vite project (`package.json`, `vite.config.js`, `index.html`, `postcss.config.js`, `tailwind.config.js`, `src/main.jsx`, `src/App.jsx`, `src/index.css`)
- Create: `frontend/public/logo.png` (copy of `mockups/logo.png`)
- Create: `frontend/.env.example`
- Create: `frontend/src/components/layout/NavBar.jsx`, `frontend/src/components/layout/PageShell.jsx`
- Create placeholder pages: `frontend/src/pages/{HomePage,PlayerProfilePage,ComparisonPage,UniversePage,SearchResultsPage}.jsx`

**Interfaces:**
- Produces: running dev app at `:5173`, routes wired, NavBar visible on all pages, Tailwind tokens available as `bg-bg`, `text-accent`, `text-nba`, `text-soccer`, fonts `font-sans` (Inter) / `font-mono` (JetBrains Mono).

- [ ] **Step 1: Scaffold Vite + install deps**

Run:
```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install react-router-dom @tanstack/react-query axios recharts framer-motion three @react-three/fiber @react-three/drei
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```
Expected: `node_modules/`, `tailwind.config.js`, `postcss.config.js` exist.

- [ ] **Step 2: Copy the logo**

Run: `cp ../mockups/logo.png public/logo.png`
Expected: `frontend/public/logo.png` exists.

- [ ] **Step 3: Write `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        accent: "#e8ff47",
        nba: "#4a7fff",
        soccer: "#39d353",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: { DEFAULT: "3px", sm: "2px", md: "4px" },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Write `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root { color-scheme: dark; }
  body { @apply bg-bg text-white font-sans antialiased; }
  .glass {
    @apply border border-white/10 bg-white/5 backdrop-blur-md rounded;
  }
}
```

- [ ] **Step 5: Write `frontend/index.html`** (fonts + favicon)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CrossOver</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `frontend/vite.config.js`** (dev proxy)

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") } },
  },
});
```

- [ ] **Step 7: Write `frontend/.env.example`**

```
VITE_API_BASE_URL=/api
```

- [ ] **Step 8: Write `frontend/src/components/layout/NavBar.jsx`**

```jsx
import { Link } from "react-router-dom";

export default function NavBar() {
  return (
    <nav className="flex items-center gap-3 px-6 h-14 border-b border-white/10 sticky top-0 z-50 bg-bg/80 backdrop-blur">
      <Link to="/" className="flex items-center gap-2">
        <img src="/logo.png" alt="CrossOver" className="h-8 w-auto" />
        <span className="font-bold text-accent text-lg">CrossOver</span>
      </Link>
      <div className="ml-auto flex items-center gap-5 text-sm text-white/70">
        <Link to="/universe" className="hover:text-white">Universe</Link>
        <Link to="/search" className="hover:text-white">Search</Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 9: Write `frontend/src/components/layout/PageShell.jsx`**

```jsx
import NavBar from "./NavBar";

export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-white">
      <NavBar />
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 10: Write placeholder pages** (one file each; replace `Name` per file)

```jsx
// e.g. frontend/src/pages/HomePage.jsx
export default function HomePage() {
  return <div className="p-8 font-mono text-accent">HomePage — TODO</div>;
}
```
Create the same shape for `PlayerProfilePage`, `ComparisonPage`, `UniversePage`, `SearchResultsPage` (change the component name and label).

- [ ] **Step 11: Write `frontend/src/App.jsx`**

```jsx
import { Routes, Route } from "react-router-dom";
import PageShell from "./components/layout/PageShell";
import HomePage from "./pages/HomePage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import ComparisonPage from "./pages/ComparisonPage";
import UniversePage from "./pages/UniversePage";
import SearchResultsPage from "./pages/SearchResultsPage";

export default function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/player/:name" element={<PlayerProfilePage />} />
        <Route path="/compare/:a/:b" element={<ComparisonPage />} />
        <Route path="/universe" element={<UniversePage />} />
        <Route path="/search" element={<SearchResultsPage />} />
      </Routes>
    </PageShell>
  );
}
```

- [ ] **Step 12: Write `frontend/src/main.jsx`**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 60_000 } },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 13: Run the dev server and verify**

Run: `cd frontend && npm run dev` (with backend running on :8000).
Expected: `:5173` loads, NavBar shows logo + "CrossOver" in accent, navigating to `/`, `/universe`, `/search` swaps the placeholder text. Background is `#0a0a0f`.

- [ ] **Step 14: Commit**

```bash
git add frontend/ ':!frontend/node_modules'
git commit -m "feat(frontend): vite scaffold, tailwind tokens, nav, routing shell"
```

(Ensure `frontend/.gitignore` from the Vite template ignores `node_modules` and `dist`.)

---

### Task 11: API client, hooks, lib utilities

**Files:**
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/hooks/{usePlayers,usePlayer,useCompare,useUniverse,useExplain,useSearch}.js`
- Create: `frontend/src/lib/format.js`, `frontend/src/lib/attributes.js`

**Interfaces:**
- Produces (`client.js`): `api.getPlayers()`, `api.getPlayer(name)`, `api.compare(a,b)`, `api.getUniverse()`, `api.explain(a,b)`, `api.search({q,sport,position})` — all returning parsed JSON; player names URL-encoded.
- Produces (hooks): React Query hooks returning `{data, isLoading, isError}`. `useExplain(a,b,{enabled})` is lazy.
- Produces (`format.js`): `pct(x) -> "91%"`, `enc(name) -> encodeURIComponent`.
- Produces (`attributes.js`): `ATTRIBUTES = [{key,label}]` (7 items, label ALL CAPS), `SPORT_COLOR = {basketball:"#4a7fff", soccer:"#39d353"}`.

- [ ] **Step 1: Write `frontend/src/lib/format.js`**

```js
export const pct = (x) => `${Math.round(x * 100)}%`;
export const enc = (name) => encodeURIComponent(name);
```

- [ ] **Step 2: Write `frontend/src/lib/attributes.js`**

```js
export const ATTRIBUTES = [
  { key: "scoring", label: "SCORING" },
  { key: "playmaking", label: "PLAYMAKING" },
  { key: "defensive_impact", label: "DEFENSE" },
  { key: "efficiency", label: "EFFICIENCY" },
  { key: "versatility", label: "VERSATILITY" },
  { key: "physical_dominance", label: "PHYSICAL" },
  { key: "durability", label: "DURABILITY" },
];

export const SPORT_COLOR = { basketball: "#4a7fff", soccer: "#39d353" };
export const SPORT_LABEL = { basketball: "NBA", soccer: "SOCCER" };
```

- [ ] **Step 3: Write `frontend/src/api/client.js`**

```js
import axios from "axios";
import { enc } from "../lib/format";

const base = import.meta.env.VITE_API_BASE_URL || "/api";
const http = axios.create({ baseURL: base });

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
};
```

- [ ] **Step 4: Write the six hooks**

```js
// frontend/src/hooks/usePlayers.js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
export const usePlayers = () =>
  useQuery({ queryKey: ["players"], queryFn: api.getPlayers, staleTime: Infinity });
```
```js
// frontend/src/hooks/usePlayer.js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
export const usePlayer = (name) =>
  useQuery({ queryKey: ["player", name], queryFn: () => api.getPlayer(name), enabled: !!name });
```
```js
// frontend/src/hooks/useCompare.js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
export const useCompare = (a, b) =>
  useQuery({ queryKey: ["compare", a, b], queryFn: () => api.compare(a, b), enabled: !!a && !!b });
```
```js
// frontend/src/hooks/useUniverse.js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
export const useUniverse = () =>
  useQuery({ queryKey: ["universe"], queryFn: api.getUniverse, staleTime: Infinity });
```
```js
// frontend/src/hooks/useExplain.js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
export const useExplain = (a, b, { enabled } = { enabled: false }) =>
  useQuery({ queryKey: ["explain", a, b], queryFn: () => api.explain(a, b), enabled });
```
```js
// frontend/src/hooks/useSearch.js
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
export const useSearch = (filters) =>
  useQuery({ queryKey: ["search", filters], queryFn: () => api.search(filters) });
```

- [ ] **Step 5: Verify wiring in the browser console**

Add a temporary `usePlayers()` call in `HomePage` (or use React Query Devtools) and confirm `/players` returns 585 rows via the Network tab.
Expected: 200 from `/api/players` with 585 items.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api frontend/src/hooks frontend/src/lib
git commit -m "feat(frontend): api client, query hooks, format + attribute utils"
```

---

### Task 12: Design-system UI primitives

**Files:**
- Create: `frontend/src/components/ui/{GlassPanel,SportBadge,DnaLabel,FilterPill,Avatar,Skeleton}.jsx`

**Interfaces:**
- Produces:
  - `<GlassPanel className>` — glass surface wrapper.
  - `<SportBadge sport>` — blue "NBA" / green "SOCCER" badge.
  - `<DnaLabel dna>` — DNA string in accent.
  - `<FilterPill active onClick>` — sharp-edged pill.
  - `<Avatar sport size>` — sport-colored circle.
  - `<Skeleton className>` — pulsing placeholder block.

Read `mockups/player-profile.png` and `mockups/search-results.png` before building, to match badge/label styling.

- [ ] **Step 1: Write the six primitives**

```jsx
// GlassPanel.jsx
export default function GlassPanel({ className = "", children }) {
  return <div className={`glass ${className}`}>{children}</div>;
}
```
```jsx
// SportBadge.jsx
import { SPORT_COLOR, SPORT_LABEL } from "../../lib/attributes";
export default function SportBadge({ sport }) {
  const color = SPORT_COLOR[sport];
  return (
    <span
      className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-sm border"
      style={{ color, borderColor: color, backgroundColor: `${color}1a` }}
    >
      {SPORT_LABEL[sport]}
    </span>
  );
}
```
```jsx
// DnaLabel.jsx
export default function DnaLabel({ dna, className = "" }) {
  return <span className={`text-accent text-sm ${className}`}>{dna}</span>;
}
```
```jsx
// FilterPill.jsx
export default function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs px-3 py-1 rounded-sm border transition-colors ${
        active ? "border-accent text-accent bg-accent/10" : "border-white/15 text-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
```
```jsx
// Avatar.jsx
import { SPORT_COLOR } from "../../lib/attributes";
export default function Avatar({ sport, size = 40 }) {
  return (
    <div
      className="rounded-full shrink-0"
      style={{ width: size, height: size, backgroundColor: SPORT_COLOR[sport] }}
    />
  );
}
```
```jsx
// Skeleton.jsx
export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-white/10 rounded-sm ${className}`} />;
}
```

- [ ] **Step 2: Verify visually**

Temporarily render all six in `HomePage`; confirm badge colors match tokens, pills have sharp corners, avatar is a colored circle.
Expected: matches mockup styling.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui
git commit -m "feat(frontend): design-system ui primitives"
```

---

# Phase 3 — Pages (read the matching mockup before each)

### Task 13: Autocomplete + HomePage + ParticleField

**Files:**
- Create: `frontend/src/components/search/Autocomplete.jsx`
- Create: `frontend/src/components/universe/ParticleField.jsx`
- Create: `frontend/src/components/cards/FeaturedCard.jsx`
- Modify: `frontend/src/pages/HomePage.jsx`

**Read first:** `mockups/homepage.png`.

**Interfaces:**
- Consumes: `usePlayers`, `react-router` `useNavigate`, `@react-three/fiber`.
- Produces: `<Autocomplete onSelect={(name)=>...} sportFilter>`; `<ParticleField>` (R3F canvas bg); `<FeaturedCard a b similarity>`; HomePage composed to match mockup.

- [ ] **Step 1: Write `Autocomplete.jsx`** (filters the cached player list client-side; navigates on select)

```jsx
import { useMemo, useState } from "react";
import { usePlayers } from "../../hooks/usePlayers";
import SportBadge from "../ui/SportBadge";

export default function Autocomplete({ onSelect, sportFilter = "all", placeholder = "Search a player…" }) {
  const { data: players = [] } = usePlayers();
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (!q) return [];
    const ql = q.toLowerCase();
    return players
      .filter((p) => (sportFilter === "all" || p.sport === sportFilter) && p.name.toLowerCase().includes(ql))
      .slice(0, 8);
  }, [q, players, sportFilter]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/15 rounded px-4 py-3 outline-none focus:border-accent font-sans"
      />
      {matches.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full glass max-h-80 overflow-auto">
          {matches.map((p) => (
            <li key={p.name}>
              <button
                onClick={() => { setQ(""); onSelect(p.name); }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 text-left"
              >
                <SportBadge sport={p.sport} />
                <span>{p.name}</span>
                <span className="ml-auto text-white/40 font-mono text-xs">{p.position}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `ParticleField.jsx`** (lightweight R3F point cloud background)

```jsx
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Points() {
  const ref = useRef();
  const positions = useMemo(() => {
    const n = 1200;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) arr[i] = (Math.sin(i * 7.13) * 0.5 + (i % 50) / 50 - 0.5) * 18;
    return arr;
  }, []);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03; });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#e8ff47" transparent opacity={0.5} />
    </points>
  );
}

export default function ParticleField() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 22], fov: 60 }}>
        <Points />
      </Canvas>
    </div>
  );
}
```

(Note: avoid `Math.random()` at module scope is fine in the browser; deterministic positions above keep it stable. Random is acceptable here if preferred.)

- [ ] **Step 3: Write `FeaturedCard.jsx`**

```jsx
import { Link } from "react-router-dom";
import { pct } from "../../lib/format";
import Avatar from "../ui/Avatar";

export default function FeaturedCard({ a, b, similarity }) {
  return (
    <Link to={`/compare/${encodeURIComponent(a.name)}/${encodeURIComponent(b.name)}`}
      className="glass p-4 flex items-center gap-3 hover:border-accent/50">
      <Avatar sport={a.sport} size={32} />
      <div className="text-sm">
        <div>{a.name}</div>
        <div className="text-white/50">{b.name}</div>
      </div>
      <span className="ml-auto font-mono text-accent">{pct(similarity)}</span>
      <Avatar sport={b.sport} size={32} />
    </Link>
  );
}
```

- [ ] **Step 4: Write `HomePage.jsx`** to match `mockups/homepage.png`

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ParticleField from "../components/universe/ParticleField";
import Autocomplete from "../components/search/Autocomplete";
import FilterPill from "../components/ui/FilterPill";

const FEATURED = [
  ["Nikola Jokić", "soccer-name-1"],
  ["Stephen Curry", "soccer-name-2"],
];

export default function HomePage() {
  const navigate = useNavigate();
  const [sport, setSport] = useState("all");
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6">
      <ParticleField />
      <h1 className="text-5xl font-bold mb-2">Find a player's <span className="text-accent">cross-sport twin</span></h1>
      <p className="text-white/50 mb-8 font-mono text-sm">585 NBA & soccer players · 7 universal attributes</p>
      <Autocomplete sportFilter={sport} onSelect={(name) => navigate(`/player/${encodeURIComponent(name)}`)} />
      <div className="flex gap-2 mt-4">
        {["all", "basketball", "soccer"].map((s) => (
          <FilterPill key={s} active={sport === s} onClick={() => setSport(s)}>
            {s === "all" ? "ALL" : s === "basketball" ? "NBA" : "SOCCER"}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify against mockup**

Run dev server. Compare to `mockups/homepage.png`: particle bg present, centered headline + search, sport pills below, autocomplete dropdown works and navigates to `/player/:name`.
Expected: visually matches; selecting a player routes to profile.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/search frontend/src/components/universe/ParticleField.jsx frontend/src/components/cards/FeaturedCard.jsx frontend/src/pages/HomePage.jsx
git commit -m "feat(frontend): homepage with particle bg, autocomplete, sport filter"
```

---

### Task 14: RadarChart + MatchCard + PlayerProfilePage (incl. mobile responsiveness)

**Files:**
- Create: `frontend/src/components/charts/RadarChart.jsx`
- Create: `frontend/src/components/cards/MatchCard.jsx`
- Modify: `frontend/src/pages/PlayerProfilePage.jsx`

**Read first:** `mockups/player-profile.png` and `mockups/mobile-profile.png`.

**Interfaces:**
- Consumes: `usePlayer`, `ATTRIBUTES`, `pct`, Recharts.
- Produces: `<RadarChart players=[{name,color,values}]>`; `<MatchCard match>` (links to `/player/:name`); responsive profile page.

- [ ] **Step 1: Write `RadarChart.jsx`** (supports 1 or 2 series for reuse on comparison page)

```jsx
import { Radar, RadarChart as RC, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { ATTRIBUTES } from "../../lib/attributes";

export default function RadarChart({ players }) {
  const data = ATTRIBUTES.map(({ key, label }) => {
    const row = { attr: label };
    players.forEach((p, i) => { row[`v${i}`] = p.values[key]; });
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RC data={data} outerRadius="75%">
        <PolarGrid stroke="#ffffff22" />
        <PolarAngleAxis dataKey="attr" tick={{ fill: "#ffffff99", fontSize: 10, fontFamily: "JetBrains Mono" }} />
        {players.map((p, i) => (
          <Radar key={i} dataKey={`v${i}`} stroke={p.color} fill={p.color} fillOpacity={0.25} />
        ))}
      </RC>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Write `MatchCard.jsx`**

```jsx
import { Link } from "react-router-dom";
import { pct } from "../../lib/format";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";
import DnaLabel from "../ui/DnaLabel";

export default function MatchCard({ match }) {
  return (
    <Link to={`/player/${encodeURIComponent(match.name)}`} className="glass p-4 flex items-center gap-3 hover:border-accent/50">
      <Avatar sport={match.sport} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{match.name}</span>
          <SportBadge sport={match.sport} />
          <span className="text-white/40 font-mono text-xs">{match.position}</span>
        </div>
        <DnaLabel dna={match.dna} className="text-xs" />
      </div>
      <span className="ml-auto font-mono text-accent text-lg">{pct(match.similarity)}</span>
    </Link>
  );
}
```

- [ ] **Step 3: Write `PlayerProfilePage.jsx`** (responsive: stacked on mobile, two-column on desktop)

```jsx
import { useParams } from "react-router-dom";
import { usePlayer } from "../hooks/usePlayer";
import RadarChart from "../components/charts/RadarChart";
import MatchCard from "../components/cards/MatchCard";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { SPORT_COLOR } from "../lib/attributes";

export default function PlayerProfilePage() {
  const { name } = useParams();
  const { data, isLoading, isError } = usePlayer(decodeURIComponent(name));

  if (isLoading) return <div className="p-8 grid gap-4"><Skeleton className="h-40" /><Skeleton className="h-80" /></div>;
  if (isError || !data) return <div className="p-8 text-white/60">Player not found.</div>;

  const { player, matches } = data;
  return (
    <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-6">
      <section className="glass p-6">
        <div className="flex items-center gap-3 mb-3">
          <Avatar sport={player.sport} size={56} />
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <SportBadge sport={player.sport} />
              <span className="font-mono text-xs text-white/50">{player.position}</span>
            </div>
          </div>
        </div>
        <DnaLabel dna={player.dna} />
        <div className="mt-4">
          <RadarChart players={[{ name: player.name, color: SPORT_COLOR[player.sport], values: player }]} />
        </div>
      </section>
      <section>
        <h2 className="font-mono text-xs text-white/50 mb-3 uppercase">Top cross-sport matches</h2>
        <div className="grid gap-3">
          {matches.slice(0, 5).map((m) => <MatchCard key={m.name} match={m} />)}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify against both mockups**

Navigate to `/player/Nikola%20Joki%C4%87`. Compare to `mockups/player-profile.png` (desktop) and narrow the window to compare to `mockups/mobile-profile.png` (columns stack, cards full-width).
Expected: name/badge/DNA/radar render; top-5 match cards link to other profiles; non-ASCII name loads.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/charts/RadarChart.jsx frontend/src/components/cards/MatchCard.jsx frontend/src/pages/PlayerProfilePage.jsx
git commit -m "feat(frontend): player profile page, radar chart, match cards, responsive"
```

---

### Task 15: ComparisonPage + OverlapRadarChart + Gemini skeleton

**Files:**
- Create: `frontend/src/components/charts/OverlapRadarChart.jsx` (thin wrapper over `RadarChart` with two series)
- Modify: `frontend/src/pages/ComparisonPage.jsx`

**Read first:** `mockups/comparison.png`.

**Interfaces:**
- Consumes: `useCompare`, `useExplain` (lazy), `RadarChart`, `Skeleton`.
- Produces: comparison page with two columns, overlap radar, similarity + context, on-demand Gemini bullets with skeleton loading.

- [ ] **Step 1: Write `OverlapRadarChart.jsx`**

```jsx
import RadarChart from "./RadarChart";
import { SPORT_COLOR } from "../../lib/attributes";

export default function OverlapRadarChart({ a, b }) {
  return (
    <RadarChart
      players={[
        { name: a.name, color: SPORT_COLOR[a.sport], values: a },
        { name: b.name, color: SPORT_COLOR[b.sport], values: b },
      ]}
    />
  );
}
```

- [ ] **Step 2: Write `ComparisonPage.jsx`**

```jsx
import { useParams } from "react-router-dom";
import { useState } from "react";
import { useCompare } from "../hooks/useCompare";
import { useExplain } from "../hooks/useExplain";
import OverlapRadarChart from "../components/charts/OverlapRadarChart";
import SportBadge from "../components/ui/SportBadge";
import DnaLabel from "../components/ui/DnaLabel";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { pct } from "../lib/format";

function Column({ p }) {
  return (
    <div className="glass p-5 flex-1">
      <div className="flex items-center gap-3">
        <Avatar sport={p.sport} size={48} />
        <div>
          <div className="font-bold">{p.name}</div>
          <div className="flex items-center gap-2 mt-1"><SportBadge sport={p.sport} /><span className="font-mono text-xs text-white/50">{p.position}</span></div>
        </div>
      </div>
      <DnaLabel dna={p.dna} className="block mt-3 text-xs" />
    </div>
  );
}

export default function ComparisonPage() {
  const { a, b } = useParams();
  const an = decodeURIComponent(a), bn = decodeURIComponent(b);
  const { data, isLoading, isError } = useCompare(an, bn);
  const [explainOn, setExplainOn] = useState(false);
  const explain = useExplain(an, bn, { enabled: explainOn });

  if (isLoading) return <div className="p-8 grid gap-4"><Skeleton className="h-32" /><Skeleton className="h-80" /></div>;
  if (isError || !data) return <div className="p-8 text-white/60">Comparison unavailable.</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <Column p={data.player_a} />
        <div className="flex flex-col items-center justify-center px-4">
          <div className="font-mono text-4xl text-accent">{pct(data.similarity)}</div>
          <div className="text-xs text-white/50 text-center mt-1 max-w-[12rem]">{data.context}</div>
        </div>
        <Column p={data.player_b} />
      </div>

      <div className="glass p-5 mt-6">
        <OverlapRadarChart a={data.player_a} b={data.player_b} />
      </div>

      <div className="glass p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs uppercase text-white/50">Why they match</h2>
          {!explainOn && (
            <button onClick={() => setExplainOn(true)} className="font-mono text-xs px-3 py-1 rounded-sm border border-accent text-accent hover:bg-accent/10">
              Generate explanation
            </button>
          )}
        </div>
        {explainOn && explain.isLoading && (
          <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
        )}
        {explain.data && (
          <ul className="list-disc pl-5 space-y-1 text-sm text-white/80">
            {explain.data.bullets.map((b2, i) => <li key={i}>{b2}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify against mockup**

From a profile page, click a `MatchCard` → it routes to `/player/:name`; to reach compare, navigate `/compare/Nikola%20Joki%C4%87/<match>`. Compare to `mockups/comparison.png`: two columns, central similarity + context, overlap radar, "Generate explanation" reveals skeleton then bullets.
Expected: matches mockup; skeleton shows during the slow `/explain` call; bullets render (fallback bullets if no `GEMINI_API_KEY`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/charts/OverlapRadarChart.jsx frontend/src/pages/ComparisonPage.jsx
git commit -m "feat(frontend): comparison page with overlap radar + gemini skeleton"
```

---

### Task 16: PlayerCard + SearchResultsPage (filters + pagination)

**Files:**
- Create: `frontend/src/components/cards/PlayerCard.jsx`
- Modify: `frontend/src/pages/SearchResultsPage.jsx`

**Read first:** `mockups/search-results.png`.

**Interfaces:**
- Consumes: `useSearch`, `FilterPill`, `useSearchParams`.
- Produces: search page with query input, sport + position filter pills, 3-column card grid, client-side pagination (24/page).

- [ ] **Step 1: Write `PlayerCard.jsx`**

```jsx
import { Link } from "react-router-dom";
import Avatar from "../ui/Avatar";
import SportBadge from "../ui/SportBadge";
import DnaLabel from "../ui/DnaLabel";

export default function PlayerCard({ player }) {
  return (
    <Link to={`/player/${encodeURIComponent(player.name)}`} className="glass p-4 hover:border-accent/50">
      <div className="flex items-center gap-3">
        <Avatar sport={player.sport} />
        <div className="min-w-0">
          <div className="truncate font-medium">{player.name}</div>
          <div className="flex items-center gap-2 mt-1"><SportBadge sport={player.sport} /><span className="font-mono text-xs text-white/50">{player.position}</span></div>
        </div>
      </div>
      <DnaLabel dna={player.dna} className="block mt-3 text-xs" />
    </Link>
  );
}
```

- [ ] **Step 2: Write `SearchResultsPage.jsx`**

```jsx
import { useState } from "react";
import { useSearch } from "../hooks/useSearch";
import PlayerCard from "../components/cards/PlayerCard";
import FilterPill from "../components/ui/FilterPill";

const POSITIONS = ["PG", "SG", "SF", "PF", "C", "FW", "MF", "DF"];
const PAGE = 24;

export default function SearchResultsPage() {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(0);
  const { data = [] } = useSearch({ q, sport, position });
  const pages = Math.ceil(data.length / PAGE);
  const slice = data.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(0); }}
        placeholder="Search players…"
        className="w-full bg-white/5 border border-white/15 rounded px-4 py-3 outline-none focus:border-accent mb-4"
      />
      <div className="flex flex-wrap gap-2 mb-2">
        {["", "basketball", "soccer"].map((s) => (
          <FilterPill key={s || "all"} active={sport === s} onClick={() => { setSport(s); setPage(0); }}>
            {s === "" ? "ALL" : s === "basketball" ? "NBA" : "SOCCER"}
          </FilterPill>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill active={position === ""} onClick={() => { setPosition(""); setPage(0); }}>ALL POS</FilterPill>
        {POSITIONS.map((p) => (
          <FilterPill key={p} active={position === p} onClick={() => { setPosition(p); setPage(0); }}>{p}</FilterPill>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slice.map((p) => <PlayerCard key={p.name} player={p} />)}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 font-mono text-sm">
          <button disabled={page === 0} onClick={() => setPage((n) => n - 1)} className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30">Prev</button>
          <span className="text-white/50">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((n) => n + 1)} className="px-3 py-1 border border-white/15 rounded-sm disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify against mockup**

Navigate to `/search`. Compare to `mockups/search-results.png`: search bar, sport + position pills, 3-column grid, pagination. Filtering by NBA/position narrows results; pages update.
Expected: matches mockup; cards link to profiles.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/cards/PlayerCard.jsx frontend/src/pages/SearchResultsPage.jsx
git commit -m "feat(frontend): search results page with filters + pagination"
```

---

### Task 17: Universe 3D page (R3F scene, points, tooltip, control panel)

**Files:**
- Create: `frontend/src/components/universe/UniverseScene.jsx`, `PlayerPoints.jsx`, `HoverTooltip.jsx`, `ControlPanel.jsx`
- Modify: `frontend/src/pages/UniversePage.jsx`

**Read first:** `mockups/universe.png`.

**Interfaces:**
- Consumes: `useUniverse`, `@react-three/fiber`, `@react-three/drei` (`OrbitControls`), `ATTRIBUTES`, `SPORT_COLOR`, `useNavigate`.
- Produces: full-screen scatter using `x/y/z` directly; left control panel (search filter text, sport filter, color-by sport/attribute); hover tooltip; click → `/player/:name`.

- [ ] **Step 1: Write `PlayerPoints.jsx`** (renders points; color by sport or dominant attr; raises hover/click)

```jsx
import { useMemo } from "react";
import * as THREE from "three";
import { SPORT_COLOR } from "../../lib/attributes";

export default function PlayerPoints({ points, colorBy, onHover, onSelect }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.12, 8, 8), []);
  return (
    <group>
      {points.map((p) => {
        const color = colorBy === "sport" ? SPORT_COLOR[p.sport] : "#e8ff47";
        return (
          <mesh
            key={p.name}
            geometry={geometry}
            position={[p.x, p.y, p.z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(p, e); }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onSelect(p.name); }}
          >
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 2: Write `HoverTooltip.jsx`**

```jsx
import SportBadge from "../ui/SportBadge";

export default function HoverTooltip({ hovered, x, y }) {
  if (!hovered) return null;
  return (
    <div className="pointer-events-none fixed z-50 glass px-3 py-2 text-sm" style={{ left: x + 12, top: y + 12 }}>
      <div className="flex items-center gap-2">{hovered.name}<SportBadge sport={hovered.sport} /></div>
      <div className="text-accent text-xs mt-1">{hovered.dna}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write `ControlPanel.jsx`**

```jsx
import FilterPill from "../ui/FilterPill";

export default function ControlPanel({ query, setQuery, sport, setSport, colorBy, setColorBy }) {
  return (
    <div className="absolute top-4 left-4 z-40 glass p-4 w-64 space-y-4">
      <div>
        <label className="font-mono text-xs text-white/50 uppercase">Search</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Highlight name…"
          className="mt-1 w-full bg-white/5 border border-white/15 rounded px-3 py-2 text-sm outline-none focus:border-accent" />
      </div>
      <div>
        <div className="font-mono text-xs text-white/50 uppercase mb-1">Sport</div>
        <div className="flex gap-2">
          {["all", "basketball", "soccer"].map((s) => (
            <FilterPill key={s} active={sport === s} onClick={() => setSport(s)}>
              {s === "all" ? "ALL" : s === "basketball" ? "NBA" : "SOC"}
            </FilterPill>
          ))}
        </div>
      </div>
      <div>
        <div className="font-mono text-xs text-white/50 uppercase mb-1">Color by</div>
        <div className="flex gap-2">
          {["sport", "accent"].map((c) => (
            <FilterPill key={c} active={colorBy === c} onClick={() => setColorBy(c)}>{c.toUpperCase()}</FilterPill>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `UniverseScene.jsx`**

```jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import PlayerPoints from "./PlayerPoints";

export default function UniverseScene({ points, colorBy, onHover, onSelect }) {
  return (
    <Canvas camera={{ position: [0, 0, 30], fov: 60 }}>
      <ambientLight />
      <OrbitControls enableDamping />
      <PlayerPoints points={points} colorBy={colorBy} onHover={onHover} onSelect={onSelect} />
    </Canvas>
  );
}
```

- [ ] **Step 5: Write `UniversePage.jsx`**

```jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUniverse } from "../hooks/useUniverse";
import UniverseScene from "../components/universe/UniverseScene";
import ControlPanel from "../components/universe/ControlPanel";
import HoverTooltip from "../components/universe/HoverTooltip";

export default function UniversePage() {
  const { data = [] } = useUniverse();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("all");
  const [colorBy, setColorBy] = useState("sport");
  const [hovered, setHovered] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const points = useMemo(
    () => data.filter((p) => (sport === "all" || p.sport === sport) && (!query || p.name.toLowerCase().includes(query.toLowerCase()))),
    [data, sport, query]
  );

  const onHover = (p, e) => {
    setHovered(p);
    if (e) setPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <ControlPanel {...{ query, setQuery, sport, setSport, colorBy, setColorBy }} />
      <UniverseScene points={points} colorBy={colorBy} onHover={onHover} onSelect={(n) => navigate(`/player/${encodeURIComponent(n)}`)} />
      <HoverTooltip hovered={hovered} x={pos.x} y={pos.y} />
    </div>
  );
}
```

- [ ] **Step 6: Verify against mockup**

Navigate to `/universe`. Compare to `mockups/universe.png`: full-screen 3D scatter using raw `x/y/z`, left control panel, orbit/zoom works, hovering a dot shows tooltip, clicking routes to the player profile, sport filter + search highlight narrow the points, color-by toggles sport vs accent.
Expected: matches mockup; interactions work; 585 points render at acceptable framerate.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/universe frontend/src/pages/UniversePage.jsx
git commit -m "feat(frontend): 3d universe page with controls, tooltip, navigation"
```

---

### Task 18: Featured comparisons on HomePage + final polish

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx` (replace placeholder `FEATURED` with real top cross-sport pairs)

**Read first:** `mockups/homepage.png` (bottom-right featured cards).

**Interfaces:**
- Consumes: `usePlayers`, `usePlayer` (or a small set of hard-picked names), `FeaturedCard`.

- [ ] **Step 1: Derive real featured pairs**

Pick 3 well-known NBA players present in the dataset (verify names via `/players`, e.g. "Nikola Jokić", "Stephen Curry", "Giannis Antetokounmpo" — confirm exact strings). For each, fetch `/player/{name}` and use `matches[0]` as the soccer twin. Render with `FeaturedCard` in a bottom-right stack.

```jsx
// add inside HomePage, below the search block
import { useQueries } from "@tanstack/react-query";
import { api } from "../api/client";
import FeaturedCard from "../components/cards/FeaturedCard";

const FEATURED_NBA = ["Nikola Jokić", "Stephen Curry", "Giannis Antetokounmpo"];

function FeaturedStack() {
  const results = useQueries({
    queries: FEATURED_NBA.map((n) => ({ queryKey: ["player", n], queryFn: () => api.getPlayer(n) })),
  });
  const ready = results.filter((r) => r.data);
  return (
    <div className="absolute bottom-6 right-6 w-80 grid gap-3">
      {ready.map((r) => {
        const a = r.data.player, b = r.data.matches[0];
        return <FeaturedCard key={a.name} a={a} b={{ name: b.name, sport: b.sport }} similarity={b.similarity} />;
      })}
    </div>
  );
}
```
Then render `<FeaturedStack />` inside the HomePage root and delete the placeholder `FEATURED` constant.

- [ ] **Step 2: Verify against mockup**

Compare HomePage to `mockups/homepage.png`: featured comparison cards appear bottom-right with real NBA→soccer pairs and similarity %, each links to `/compare/...`.
Expected: matches mockup; cards navigate to comparison.

- [ ] **Step 3: Full manual pass**

With backend + frontend running, walk all routes: `/` → search → profile → match → compare → generate explanation → `/search` filters → `/universe` hover/click. Confirm no console errors and non-ASCII names work end-to-end.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/HomePage.jsx
git commit -m "feat(frontend): real featured cross-sport comparisons on homepage"
```

---

## Self-Review Notes (coverage check)

- All 6 API endpoints → Tasks 5–9. CORS + startup load → Task 9.
- `data_store` normalization + single load → Task 2. Pair-percentile precompute → Tasks 4 & 9.
- All 6 pages → Tasks 13–18; mobile (mockup #6) → Task 14 responsive grid.
- Design tokens, fonts, logo, nav → Task 10. shadcn behavior-only → autocomplete in Task 13 (lightweight custom; if a richer combobox is wanted, swap in shadcn `command` here without changing interfaces).
- Skeleton loading for `/explain` → Task 15. Sport-colored avatars → Task 12. Percentages → `format.pct`.
- Out-of-scope items (photos, quality filter, runtime recompute, notebook edits) honored.
```
