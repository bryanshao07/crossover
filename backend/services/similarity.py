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
