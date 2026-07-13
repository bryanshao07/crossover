from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db
from db_models import SavedComparison, User

router = APIRouter(prefix="/comparisons", tags=["comparisons"])


class ComparisonCreate(BaseModel):
    player_a: str
    player_b: str
    similarity_score: Optional[float] = None


class SavedComparisonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    player_a: str
    player_b: str
    similarity_score: Optional[float]
    created_at: datetime


@router.post("", response_model=SavedComparisonResponse, status_code=status.HTTP_201_CREATED)
def save_comparison(
    body: ComparisonCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedComparisonResponse:
    comparison = SavedComparison(
        user_id=current_user.id,
        player_a=body.player_a,
        player_b=body.player_b,
        similarity_score=body.similarity_score,
    )
    db.add(comparison)
    db.commit()
    db.refresh(comparison)
    return SavedComparisonResponse.model_validate(comparison)


@router.get("", response_model=List[SavedComparisonResponse])
def list_comparisons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SavedComparisonResponse]:
    comparisons = (
        db.query(SavedComparison)
        .filter(SavedComparison.user_id == current_user.id)
        .order_by(SavedComparison.created_at.desc())
        .all()
    )
    return [SavedComparisonResponse.model_validate(c) for c in comparisons]


@router.delete("/{comparison_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comparison(
    comparison_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    comparison = (
        db.query(SavedComparison)
        .filter(
            SavedComparison.id == comparison_id,
            SavedComparison.user_id == current_user.id,
        )
        .first()
    )
    if not comparison:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comparison not found")
    db.delete(comparison)
    db.commit()
