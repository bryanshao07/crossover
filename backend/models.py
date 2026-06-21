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
    # Snapshot fields — populated from nba-stats.csv / soccer-stats.csv
    age: Optional[str] = None
    team: Optional[str] = None
    pos: Optional[str] = None
    nation: Optional[str] = None
    pts_per_game: Optional[float] = None
    ast_per_game: Optional[float] = None
    trb_per_game: Optional[float] = None
    goals: Optional[float] = None
    assists: Optional[float] = None
    headshot_url: Optional[str] = None


class SimilarityMatch(BaseModel):
    name: str
    sport: str
    position: str
    dna: str
    similarity: float
    quality: Optional[float] = None
    headshot_url: Optional[str] = None


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
    quality: Optional[float] = None


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
