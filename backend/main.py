from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import data_store
from config import settings
from routers import auth, compare, comparisons, explain, favorites, players, universe
from services import similarity

data_store.load()
similarity.build_pair_distribution()

Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CrossOver API")
app.mount("/static", StaticFiles(directory=settings.uploads_dir), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://crossover-ten-theta.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(players.router)
app.include_router(compare.router)
app.include_router(universe.router)
app.include_router(explain.router)
app.include_router(comparisons.router)
app.include_router(favorites.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "players": len(data_store.players())}
