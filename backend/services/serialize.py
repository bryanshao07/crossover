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
