from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import data_store
from config import settings
from routers import compare, explain, players, universe
from services import similarity

data_store.load()
similarity.build_pair_distribution()

app = FastAPI(title="CrossOver API")

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
app.include_router(players.router)
app.include_router(compare.router)
app.include_router(universe.router)
app.include_router(explain.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "players": len(data_store.players())}
