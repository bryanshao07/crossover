import re
from typing import List, Optional

from config import settings
from models import Player

_model = None
if settings.gemini_api_key:
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel(settings.gemini_card_model)
    except Exception:
        _model = None

ATTRS = [
    "scoring", "playmaking", "defensive_impact", "efficiency",
    "versatility", "physical_dominance", "durability",
]


def _abs_stats(p: Player) -> List[str]:
    """Real per-game / aggregate counting stats already on the Player."""
    out: List[str] = []
    if p.sport == "basketball":
        if p.pts_per_game is not None:
            out.append(f"{p.pts_per_game} PPG")
        if p.ast_per_game is not None:
            out.append(f"{p.ast_per_game} APG")
        if p.trb_per_game is not None:
            out.append(f"{p.trb_per_game} RPG")
    else:
        if p.goals is not None:
            out.append(f"{int(p.goals)} goals")
        if p.assists is not None:
            out.append(f"{int(p.assists)} assists")
    return out


def _clean_metric(key: str) -> str:
    name = key[:-4] if key.endswith("_pct") else key   # drop the _pct suffix
    return name.split("_stats")[0]                       # drop _stats_defense/_misc tails


def _top_percentiles(pct: Optional[dict], n: int = 3) -> List[str]:
    """The player's n strongest percentile ranks, rendered as 'AST top 8%'.
    pct values are 0-1 (0.93 -> 93rd percentile -> top 7%)."""
    ranks = []
    for k, v in (pct or {}).items():
        if k in ("Player", "Pos") or v is None:
            continue
        try:
            ranks.append((_clean_metric(k), int(round(float(v) * 100))))
        except (TypeError, ValueError):
            continue
    ranks.sort(key=lambda x: -x[1])
    return [f"{name} top {max(1, 100 - rank)}%" for name, rank in ranks[:n]]


def _stat_line(p: Player, pct: Optional[dict]) -> str:
    return ", ".join(_abs_stats(p) + _top_percentiles(pct)) or "n/a"


def build_prompt(a: Player, b: Player, sim: float,
                 card_a: Optional[str], card_b: Optional[str],
                 pct_a: Optional[dict], pct_b: Optional[dict]) -> str:
    grounding = ""
    if card_a:
        grounding += f"\nScouting note — {a.name}: {card_a}"
    if card_b:
        grounding += f"\nScouting note — {b.name}: {card_b}"
    if grounding:
        grounding += "\nGround the bullets in these scouting notes where relevant.\n"
    return (
        "You are a cross-sport scout. Explain in 4 short bullet points why this "
        f"NBA/soccer pairing is a {sim*100:.0f}% match across these universal "
        "attributes: scoring, playmaking, defensive_impact, efficiency, versatility, "
        "physical_dominance, durability.\n\n"
        f"{a.name} ({a.sport}, {a.position}) — DNA: {a.dna}\n"
        f"attributes: { {k: round(getattr(a, k), 2) for k in ATTRS} }\n"
        f"key stats: {_stat_line(a, pct_a)}\n\n"
        f"{b.name} ({b.sport}, {b.position}) — DNA: {b.dna}\n"
        f"attributes: { {k: round(getattr(b, k), 2) for k in ATTRS} }\n"
        f"key stats: {_stat_line(b, pct_b)}\n"
        f"{grounding}\n"
        "Return ONLY bullet points, one per line, each starting with '- '. "
        "Be concrete and reference specific shared strengths and contrasts. "
        "Cite real numbers from 'key stats' where they strengthen a point, and wrap "
        "EVERY statistic, number, or metric you mention in **double asterisks** so it "
        "renders bold — e.g. **27.4 PPG**, **top 8% in assists**, **12 goals**."
    )


def _fallback(a: Player, b: Player, sim: float) -> List[str]:
    shared = sorted(
        ATTRS, key=lambda k: abs(getattr(a, k) - getattr(b, k))
    )
    diverge = sorted(
        ATTRS, key=lambda k: -abs(getattr(a, k) - getattr(b, k))
    )
    nice = lambda s: s.replace("_", " ")
    return [
        f"Overall {sim*100:.0f}% cross-sport similarity between {a.name} and {b.name}.",
        f"Closest shared traits: {nice(shared[0])} and {nice(shared[1])}.",
        f"Biggest contrast: {nice(diverge[0])}.",
        f"Both profiles read as: {a.dna.split(' · ')[0]} ↔ {b.dna.split(' · ')[0]}.",
    ]


# Strip a single leading bullet marker ("- ", "• ", or a lone "* ") without
# consuming the "**" of a bolded metric that opens the bullet.
_BULLET_RE = re.compile(r"^\s*(?:[-•]\s+|\*(?!\*)\s*)")


def _parse_bullets(text: str) -> List[str]:
    out: List[str] = []
    for ln in text.splitlines():
        ln = _BULLET_RE.sub("", ln.strip(), count=1).strip()
        if ln:
            out.append(ln)
    return out[:6]


def explain(a: Player, b: Player, sim: float,
            card_a: Optional[str], card_b: Optional[str],
            pct_a: Optional[dict], pct_b: Optional[dict]) -> List[str]:
    if _model is None:
        return _fallback(a, b, sim)
    try:
        resp = _model.generate_content(build_prompt(a, b, sim, card_a, card_b, pct_a, pct_b))
        bullets = _parse_bullets(resp.text or "")
        return bullets or _fallback(a, b, sim)
    except Exception:
        return _fallback(a, b, sim)
