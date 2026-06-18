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
