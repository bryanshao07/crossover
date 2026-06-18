from typing import List

from fastapi import APIRouter

import data_store as ds
from models import UMAPPlayer

router = APIRouter()


@router.get("/universe", response_model=List[UMAPPlayer])
def universe() -> List[UMAPPlayer]:
    return [UMAPPlayer(**row) for row in ds.umap()]
