"""
map_pl_ids.py

Builds exports/pl_id_map.json — a dict mapping soccer player display names
(as they appear in player_index.json) to their Premier League numeric player IDs.

Matching strategy (applied in order, stopping at first success):
  Pass 1 — full name match  (first_name + " " + second_name)
    1a. Exact match after unicode normalization (strip accents, lowercase)
    1b. Fuzzy fallback using rapidfuzz token_sort_ratio >= 85

  Pass 2 — web_name match  (display name, often mononym e.g. "Rodri", "Joelinton")
    Same exact+fuzzy logic applied to players still unmatched after Pass 1.

Outputs exports/pl_id_map.json as { "Player Name": pl_id }
Prints match summary and lists all unmatched players.
"""

import json
import unicodedata
import urllib.request
from pathlib import Path

from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parent.parent
PLAYER_INDEX = ROOT / "exports" / "player_index.json"
MANUAL_PATCH = Path(__file__).resolve().parent / "pl_id_manual.json"
OUTPUT = ROOT / "exports" / "pl_id_map.json"

BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"
FUZZY_THRESHOLD = 85


def normalize(name: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(ascii_name.lower().split())


def build_lookup(players: list[dict], name_fn) -> dict[str, tuple[int, str]]:
    """Returns {normalized_name: (pl_code, display_name)}."""
    lookup: dict[str, tuple[int, str]] = {}
    for p in players:
        display = name_fn(p)
        norm = normalize(display)
        if norm not in lookup:  # first entry wins on collision
            lookup[norm] = (int(p["code"]), display)  # code = persistent photo ID
    return lookup


def match_batch(
    candidates: list[str],
    lookup: dict[str, tuple[int, str]],
) -> tuple[dict[str, int], list[tuple[str, str, float]], list[str]]:
    matched: dict[str, int] = {}
    fuzzy: list[tuple[str, str, float]] = []
    unmatched: list[str] = []

    for display in candidates:
        norm = normalize(display)

        if norm in lookup:
            matched[display] = lookup[norm][0]
            continue

        best_score = 0.0
        best_id = None
        best_api_name = None
        for api_norm, (pid, api_display) in lookup.items():
            score = fuzz.token_sort_ratio(norm, api_norm)
            if score > best_score:
                best_score = score
                best_id = pid
                best_api_name = api_display

        if best_score >= FUZZY_THRESHOLD:
            matched[display] = best_id
            fuzzy.append((display, best_api_name, best_score))
        else:
            unmatched.append(display)

    return matched, fuzzy, unmatched


def fetch_bootstrap() -> list[dict]:
    print(f"Fetching {BOOTSTRAP_URL} ...")
    req = urllib.request.Request(
        BOOTSTRAP_URL,
        headers={"User-Agent": "Mozilla/5.0 (crossover-mapper/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    elements = data["elements"]
    print(f"  PL bootstrap returned {len(elements)} player elements")
    return elements


def main():
    # ── Load our soccer players ───────────────────────────────────────────────
    index = json.loads(PLAYER_INDEX.read_text())
    soccer_entries = [e for e in index if e["sport"] == "soccer"]
    total_soccer = len(soccer_entries)
    all_names = [e["player"] for e in soccer_entries]
    print(f"Soccer players in player_index.json: {total_soccer}")

    # ── Fetch PL bootstrap ────────────────────────────────────────────────────
    elements = fetch_bootstrap()

    # ── Pass 1: full name (first_name + " " + second_name) ───────────────────
    print("\n[Pass 1] Matching against full names (first + last)...")
    full_name_lookup = build_lookup(
        elements,
        lambda p: f"{p['first_name']} {p['second_name']}",
    )
    print(f"  Unique full-name keys: {len(full_name_lookup)}")

    p1_matched, p1_fuzzy, p1_unmatched = match_batch(all_names, full_name_lookup)
    p1_exact_count = len(p1_matched) - len(p1_fuzzy)
    print(f"  Exact: {p1_exact_count}  Fuzzy: {len(p1_fuzzy)}  Unmatched: {len(p1_unmatched)}")

    # ── Pass 2: web_name fallback (mononyms, nicknames) ──────────────────────
    print(f"\n[Pass 2] Matching remaining {len(p1_unmatched)} against web_name...")
    web_name_lookup = build_lookup(elements, lambda p: p["web_name"])
    print(f"  Unique web_name keys: {len(web_name_lookup)}")

    p2_matched, p2_fuzzy, p2_unmatched = match_batch(p1_unmatched, web_name_lookup)
    p2_exact_count = len(p2_matched) - len(p2_fuzzy)
    print(f"  Exact: {p2_exact_count}  Fuzzy: {len(p2_fuzzy)}  Unmatched: {len(p2_unmatched)}")

    # ── Manual patch ─────────────────────────────────────────────────────────
    manual = json.loads(MANUAL_PATCH.read_text()) if MANUAL_PATCH.exists() else {}
    if manual:
        print(f"\n[Manual patch] Applying {len(manual)} override(s)...")

    # ── Merge (manual wins) ───────────────────────────────────────────────────
    id_map: dict[str, int] = {**p1_matched, **p2_matched, **manual}
    final_unmatched = [n for n in p2_unmatched if n not in manual]

    # Write output
    OUTPUT.write_text(json.dumps(id_map, indent=2, ensure_ascii=False))

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("FINAL MATCH SUMMARY")
    print("=" * 60)
    print(f"  Total soccer players:      {total_soccer}")
    print(f"  Pass 1 exact matches:      {p1_exact_count}")
    print(f"  Pass 1 fuzzy matches:      {len(p1_fuzzy)}")
    print(f"  Pass 2 exact matches:      {p2_exact_count}")
    print(f"  Pass 2 fuzzy matches:      {len(p2_fuzzy)}")
    print(f"  Manual patch:              {len(manual)}")
    print(f"  Total matched:             {len(id_map)}")
    print(f"  Unmatched:                 {len(final_unmatched)}")
    print(f"  Written to:                {OUTPUT}")

    if p1_fuzzy:
        print("\n--- PASS 1 FUZZY MATCHES (verify these) ---")
        for our_name, api_name, score in sorted(p1_fuzzy, key=lambda x: x[2]):
            print(f"  [{score:5.1f}]  {our_name!r}  →  {api_name!r}")

    if p2_fuzzy:
        print("\n--- PASS 2 FUZZY MATCHES (verify these) ---")
        for our_name, api_name, score in sorted(p2_fuzzy, key=lambda x: x[2]):
            print(f"  [{score:5.1f}]  {our_name!r}  →  {api_name!r}")

    if final_unmatched:
        print(f"\n--- STILL UNMATCHED ({len(final_unmatched)}) ---")
        for name in sorted(final_unmatched):
            print(f"  {name!r}")
    else:
        print("\nAll soccer players matched successfully.")


if __name__ == "__main__":
    main()
