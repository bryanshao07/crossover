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

MAX_RETRIES = 6
BASE_BACKOFF = 8.0  # seconds; doubled each rate-limit retry, capped at CAP_BACKOFF
CAP_BACKOFF = 120.0


def _is_rate_limit(e: Exception) -> bool:
    """True if the exception looks like a 429 / quota / rate-limit error."""
    s = str(e).lower()
    return any(t in s for t in ("429", "quota", "rate limit", "ratelimit", "exhaust", "resource_exhausted"))


def _retry_delay_hint(e: Exception):
    """Honor the API's suggested retry delay when it carries one (seconds)."""
    rd = getattr(e, "retry_delay", None)
    secs = getattr(rd, "seconds", None)
    return float(secs) if secs else None


def _call_with_retry(fn, label: str):
    """Call fn() with exponential backoff. Rate-limit errors back off long
    (honoring the API's retry_delay hint when present); other transient errors
    back off briefly. Re-raises the last error after MAX_RETRIES attempts."""
    last: Exception = RuntimeError("no attempt made")
    for attempt in range(MAX_RETRIES):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — offline batch job, retry everything
            last = e
            if attempt == MAX_RETRIES - 1:
                break
            if _is_rate_limit(e):
                wait = _retry_delay_hint(e) or min(BASE_BACKOFF * (2 ** attempt), CAP_BACKOFF)
            else:
                wait = min(2.0 * (2 ** attempt), 30.0)
            print(f"retry {label} (attempt {attempt + 1}/{MAX_RETRIES}) in {wait:.0f}s: {str(e)[:120]}")
            time.sleep(wait)
    raise last


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
                cards[name] = _call_with_retry(
                    lambda: (model.generate_content(prompt).text or "").strip(),
                    f"card {name}",
                )
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
            resp = _call_with_retry(
                lambda: genai.embed_content(model=EMBED_MODEL, content=text,
                                            task_type="retrieval_document"),
                f"embed {name}",
            )
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
