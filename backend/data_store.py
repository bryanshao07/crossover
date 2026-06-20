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
_nba_stats: Dict[str, dict] = {}
_soccer_stats: Dict[str, dict] = {}
_nba_id_map: Dict[str, int] = {}
_pl_id_map: Dict[str, int] = {}
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
    global _index, _index_by_name, _vectors, _umap, _quality, _pct, _sim, _nba_stats, _soccer_stats, _nba_id_map, _pl_id_map, _loaded
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

    nba_df = pd.read_csv(Path(settings.exports_dir) / "nba-stats.csv")
    for _, row in nba_df.iterrows():
        name = str(row["Player"]).strip()
        if name not in _nba_stats:
            _nba_stats[name] = row.to_dict()

    soccer_df = pd.read_csv(Path(settings.exports_dir) / "soccer-stats.csv")
    for _, row in soccer_df.iterrows():
        name = str(row["Player"]).strip()
        if name not in _soccer_stats:
            _soccer_stats[name] = row.to_dict()

    _nba_id_map = _read_json("nba_id_map.json")
    _pl_id_map = _read_json("pl_id_map.json")

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


def nba_stats(name: str) -> dict:
    return _nba_stats.get(name, {})


def soccer_stats(name: str) -> dict:
    return _soccer_stats.get(name, {})


def nba_headshot_url(name: str) -> Optional[str]:
    nba_id = _nba_id_map.get(name)
    if nba_id is None:
        return None
    return f"https://cdn.nba.com/headshots/nba/latest/260x190/{nba_id}.png"


def pl_headshot_url(name: str) -> Optional[str]:
    code = _pl_id_map.get(name)
    if code is None:
        return None
    return f"https://resources.premierleague.com/premierleague/photos/players/110x140/p{code}.png"
