"""Offline: generate player style cards + embeddings into exports/.

Run from backend/:  venv/bin/python -m scripts.build_rag
Requires GEMINI_API_KEY. Idempotent — reruns only fill in missing players.
"""
import json
import os
import time
from pathlib import Path
from typing import Dict

from config import settings
import data_store as ds

CARDS_PATH = Path(settings.exports_dir) / "style_cards.json"
EMB_PATH = Path(settings.exports_dir) / "style_embeddings.json"
CARD_MODEL = "gemini-2.5-flash"
EMBED_MODEL = "models/text-embedding-004"


def _is_empty(v):
    """Check if a stat value is empty/missing (None, empty string, literal 'nan', or float NaN)."""
    return v is None or v == "" or v == "nan" or v != v  # v != v catches float('nan')


def card_prompt(name: str, sport: str, position: str, stats: dict) -> str:
    line = ", ".join(f"{k}={v}" for k, v in stats.items() if not _is_empty(v))
    return (
        f"Write a 3 sentence scouting profile of this {sport} player's playing "
        "style, strengths, and weaknesses. Be concrete and stylistic; do NOT "
        "simply restate the numbers.\n"
        f"Player: {name} ({position})\nStats: {line}"
    )


def _load(path: Path) -> Dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _save(path: Path, obj: Dict) -> None:
    # Write to a temp file in the same directory, then atomically swap it into
    # place (os.replace is atomic on POSIX) so an interrupted run can never
    # leave a half-written / truncated JSON file at `path`.
    tmp = path.parent / f"{path.name}.tmp"
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=0), encoding="utf-8")
    os.replace(tmp, path)


def _stats_for(name: str, sport: str) -> dict:
    row = ds.nba_stats(name) if sport == "basketball" else ds.soccer_stats(name)
    return {k: v for k, v in row.items() if k not in ("Player",)}


def main() -> None:
    import google.generativeai as genai

    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY required to build RAG artifacts.")
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(CARD_MODEL)

    ds.load()
    cards = _load(CARDS_PATH)
    embs = _load(EMB_PATH)
    players = ds.players()

    for i, p in enumerate(players):
        name = p["name"]
        if name not in cards:
            prompt = card_prompt(name, p["sport"], p["position"], _stats_for(name, p["sport"]))
            try:
                cards[name] = (model.generate_content(prompt).text or "").strip()
            except Exception as e:
                print(f"card FAIL {name}: {e}")
                continue
            if i % 20 == 0:
                _save(CARDS_PATH, cards)
                print(f"cards {i}/{len(players)}")
            time.sleep(0.2)
    _save(CARDS_PATH, cards)

    for i, (name, text) in enumerate(cards.items()):
        if name in embs or not text:
            continue
        try:
            resp = genai.embed_content(model=EMBED_MODEL, content=text,
                                       task_type="retrieval_document")
            embs[name] = list(resp["embedding"])
        except Exception as e:
            print(f"embed FAIL {name}: {e}")
            continue
        if i % 20 == 0:
            _save(EMB_PATH, embs)
            print(f"embeds {i}/{len(cards)}")
        time.sleep(0.2)
    _save(EMB_PATH, embs)
    print(f"done: {len(cards)} cards, {len(embs)} embeddings")


if __name__ == "__main__":
    main()
