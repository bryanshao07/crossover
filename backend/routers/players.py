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
    return [_with_attributes(r) for r in rows]


def _with_attributes(row: dict) -> dict:
    vec = ds.vector(row["name"]) or {}
    headshot = {"headshot_url": ds.nba_headshot_url(row["name"])} if row.get("sport") == "basketball" else {}
    return {**row, **{attr: vec.get(attr) for attr in ds.ATTRS}, **headshot}
