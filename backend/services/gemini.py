from typing import List, Optional

from config import settings
from models import Player

_model = None
if settings.gemini_api_key:
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    except Exception:
        _model = None

ATTRS = [
    "scoring", "playmaking", "defensive_impact", "efficiency",
    "versatility", "physical_dominance", "durability",
]


def build_prompt(a: Player, b: Player, sim: float,
                 card_a: Optional[str], card_b: Optional[str]) -> str:
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
        f"attributes: { {k: round(getattr(a, k), 2) for k in ATTRS} }\n\n"
        f"{b.name} ({b.sport}, {b.position}) — DNA: {b.dna}\n"
        f"attributes: { {k: round(getattr(b, k), 2) for k in ATTRS} }\n"
        f"{grounding}\n"
        "Return ONLY bullet points, one per line, each starting with '- '. "
        "Be concrete, reference specific shared strengths and contrasts."
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


def _parse_bullets(text: str) -> List[str]:
    lines = [ln.strip().lstrip("-•* ").strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln][:6]


def explain(a: Player, b: Player, sim: float,
            card_a: Optional[str], card_b: Optional[str]) -> List[str]:
    if _model is None:
        return _fallback(a, b, sim)
    try:
        resp = _model.generate_content(build_prompt(a, b, sim, card_a, card_b))
        bullets = _parse_bullets(resp.text or "")
        return bullets or _fallback(a, b, sim)
    except Exception:
        return _fallback(a, b, sim)
