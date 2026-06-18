from typing import Dict, List, Optional

from pydantic import BaseModel


class Player(BaseModel):
    name: str
    sport: str
    position: str
    dna: str
    scoring: float
    playmaking: float
    defensive_impact: float
    efficiency: float
    versatility: float
    physical_dominance: float
    durability: float


class SimilarityMatch(BaseModel):
    name: str
    sport: str
    position: str
    dna: str
    similarity: float
    quality: Optional[float] = None


class PlayerDetail(BaseModel):
    player: Player
    matches: List[SimilarityMatch]


class UMAPPlayer(BaseModel):
    name: str
    sport: str
    position: str
    x: float
    y: float
    z: float
    dominant_attr: Optional[str] = None
    dna: str


class CompareResult(BaseModel):
    player_a: Player
    player_b: Player
    similarity: float
    percentile: float
    context: str
    stats_a: Dict[str, float]
    stats_b: Dict[str, float]


class Explanation(BaseModel):
    bullets: List[str]
