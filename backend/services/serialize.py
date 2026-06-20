from typing import Optional

import data_store as ds
from models import Player


def _safe_float(val) -> Optional[float]:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def player_model(name: str) -> Optional[Player]:
    base = ds.get_player(name)
    vec = ds.vector(name)
    if base is None or vec is None:
        return None

    extra: dict = {}
    if base["sport"] == "basketball":
        row = ds.nba_stats(name)
        if row:
            g = _safe_float(row.get("G"))
            extra["age"] = str(row.get("Age", "")) or None
            extra["team"] = str(row.get("Team", "")) or None
            extra["pos"] = str(row.get("Pos", "")) or None
            if g:
                mp = _safe_float(row.get("MP"))
                pts = _safe_float(row.get("PTS"))
                ast = _safe_float(row.get("AST"))
                trb = _safe_float(row.get("TRB"))
                mpg = mp / g if mp is not None else None
                extra["pts_per_game"] = round(pts * mpg / 36, 1) if pts is not None and mpg is not None else None
                extra["ast_per_game"] = round(ast * mpg / 36, 1) if ast is not None and mpg is not None else None
                extra["trb_per_game"] = round(trb * mpg / 36, 1) if trb is not None and mpg is not None else None
    else:
        row = ds.soccer_stats(name)
        if row:
            extra["age"] = str(row.get("Age", "")) or None
            extra["team"] = str(row.get("Squad", "")) or None
            extra["nation"] = str(row.get("Nation", "")) or None
            extra["pos"] = str(row.get("Pos", "")) or None
            gls = _safe_float(row.get("Gls"))
            ast = _safe_float(row.get("Ast"))
            extra["goals"] = int(gls) if gls is not None else None
            extra["assists"] = int(ast) if ast is not None else None

    return Player(
        name=base["name"], sport=base["sport"], position=base["position"],
        dna=base["dna"],
        scoring=vec["scoring"], playmaking=vec["playmaking"],
        defensive_impact=vec["defensive_impact"], efficiency=vec["efficiency"],
        versatility=vec["versatility"], physical_dominance=vec["physical_dominance"],
        durability=vec["durability"],
        **extra,
    )
