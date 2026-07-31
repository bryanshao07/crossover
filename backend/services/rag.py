from functools import lru_cache
from typing import List, Optional

import numpy as np

import data_store as ds
from config import settings

# Must match scripts/build_rag.py's document-embedding model (both read the same
# setting) — otherwise query and document vectors live in different spaces.
EMBED_MODEL = settings.gemini_embed_model

_genai = None
if settings.gemini_api_key:
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        _genai = genai
    except Exception:
        _genai = None


@lru_cache(maxsize=512)
def embed_query(text: str) -> Optional[List[float]]:
    if _genai is None:
        return None
    try:
        resp = _genai.embed_content(
            model=EMBED_MODEL, content=text, task_type="retrieval_query"
        )
        return list(resp["embedding"])
    except Exception:
        return None


def semantic_search(
    query: str,
    sport: Optional[str],
    position: Optional[str],
    limit: int,
) -> Optional[List[str]]:
    mat = ds.embedding_matrix()
    names = ds.embedding_names()
    if mat is None or not names:
        return None
    qv = embed_query(query)
    if qv is None:
        return None
    q = np.asarray(qv, dtype=float)
    norm = np.linalg.norm(q) or 1.0
    sims = mat @ (q / norm)
    out: List[str] = []
    for idx in np.argsort(-sims):
        name = names[idx]
        row = ds.get_player(name)
        if row is None:
            continue
        if sport and row["sport"] != sport:
            continue
        if position and row["position"] != position:
            continue
        out.append(name)
        if len(out) >= limit:
            break
    return out
