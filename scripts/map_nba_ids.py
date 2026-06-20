"""
map_nba_ids.py

Builds exports/nba_id_map.json — a dict mapping NBA player display names
(as they appear in player_index.json) to their stats.nba.com numeric player IDs.

Matching strategy (applied in order, stopping at first success):
  Pass 1 — nba_api.stats.static.players.get_active_players()
    1a. Exact match after unicode normalization (strip accents, lowercase)
    1b. Fuzzy fallback using rapidfuzz token_sort_ratio >= 85

  Pass 2 — commonallplayers endpoint with is_only_current_season=1, league_id='00'
    Same exact+fuzzy logic applied to players still unmatched after Pass 1.
    Catches rookies and two-way players missing from the static dataset.

  Manual patch — scripts/nba_id_manual.json
    Format: { "Player Name": nba_id }   e.g. { "Cooper Flagg": 1642256 }
    Merged last; takes priority over all automated passes.
    Add entries here for any players that both automated passes miss.

Outputs only NBA players (soccer entries are skipped).
Prints a per-pass summary and the final unmatched list.
"""

import json
import time
import unicodedata
from pathlib import Path

from nba_api.stats.endpoints import commonallplayers
from nba_api.stats.static import players as nba_players
from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parent.parent
PLAYER_INDEX = ROOT / "exports" / "player_index.json"
MANUAL_PATCH = Path(__file__).resolve().parent / "nba_id_manual.json"
OUTPUT = ROOT / "exports" / "nba_id_map.json"

FUZZY_THRESHOLD = 85


def normalize(name: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(ascii_name.lower().split())


def build_lookup_from_list(players: list[dict], id_key: str, name_key: str) -> dict[str, tuple[int, str]]:
    """Returns {normalized_name: (player_id, display_name)}."""
    lookup = {}
    for p in players:
        norm = normalize(p[name_key])
        lookup[norm] = (int(p[id_key]), p[name_key])
    return lookup


def match_batch(
    candidates: list[str],
    lookup: dict[str, tuple[int, str]],
) -> tuple[dict[str, int], list[tuple[str, str, float]], list[str]]:
    """
    Try to match each name in candidates against lookup.
    Returns (matched_map, fuzzy_details, still_unmatched).
    """
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


def main():
    index = json.loads(PLAYER_INDEX.read_text())
    nba_entries = [e for e in index if e["sport"] == "basketball"]
    total_nba = len(nba_entries)
    all_names = [e["player"] for e in nba_entries]

    print(f"NBA players in player_index.json: {total_nba}")

    # ── Pass 1: static active players ────────────────────────────────────────
    print("\n[Pass 1] Fetching static active players list...")
    static_players = nba_players.get_active_players()
    p1_lookup = build_lookup_from_list(static_players, "id", "full_name")
    print(f"  Static list: {len(p1_lookup)} players")

    p1_matched, p1_fuzzy, p1_unmatched = match_batch(all_names, p1_lookup)
    p1_exact_count = len(p1_matched) - len(p1_fuzzy)
    print(f"  Exact: {p1_exact_count}  Fuzzy: {len(p1_fuzzy)}  Unmatched: {len(p1_unmatched)}")

    # ── Pass 2: live commonallplayers (current season only) ──────────────────
    print(f"\n[Pass 2] Fetching live commonallplayers (current season)...")
    time.sleep(1)  # be polite to the NBA API
    cap = commonallplayers.CommonAllPlayers(
        is_only_current_season=1,
        league_id="00",
        season="2025-26",
        timeout=30,
    )
    cap_df = cap.get_data_frames()[0]
    cap_records = cap_df[["PERSON_ID", "DISPLAY_FIRST_LAST"]].to_dict("records")
    p2_lookup = build_lookup_from_list(cap_records, "PERSON_ID", "DISPLAY_FIRST_LAST")
    # Exclude players already matched in pass 1 from the lookup to avoid noise
    print(f"  Live endpoint: {len(p2_lookup)} players")

    p2_matched, p2_fuzzy, p2_unmatched = match_batch(p1_unmatched, p2_lookup)
    p2_exact_count = len(p2_matched) - len(p2_fuzzy)
    print(f"  Exact: {p2_exact_count}  Fuzzy: {len(p2_fuzzy)}  Unmatched: {len(p2_unmatched)}")

    # ── Manual patch ─────────────────────────────────────────────────────────
    manual = json.loads(MANUAL_PATCH.read_text()) if MANUAL_PATCH.exists() else {}
    if manual:
        print(f"\n[Manual patch] Applying {len(manual)} override(s)...")

    # ── Merge (manual wins) ───────────────────────────────────────────────────
    id_map: dict[str, int] = {**p1_matched, **p2_matched, **manual}

    # Determine final unmatched (exclude any covered by manual patch)
    final_unmatched = [n for n in p2_unmatched if n not in manual]

    # Write output
    OUTPUT.write_text(json.dumps(id_map, indent=2, ensure_ascii=False))

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("FINAL MATCH SUMMARY")
    print("=" * 60)
    print(f"  Total NBA players:         {total_nba}")
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
        print("\nAll NBA players matched successfully.")


if __name__ == "__main__":
    main()
