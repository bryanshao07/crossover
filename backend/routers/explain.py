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
    bullets = gemini.explain(
        a, b, sim,
        ds.style_card(a.name), ds.style_card(b.name),
        ds.pct_stats(a.name, a.sport), ds.pct_stats(b.name, b.sport),
    )
    return Explanation(bullets=bullets)
