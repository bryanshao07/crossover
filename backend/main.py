from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import data_store
from config import settings
from routers import compare, players, universe
from services import similarity

data_store.load()
similarity.build_pair_distribution()

app = FastAPI(title="CrossOver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(compare.router)
app.include_router(universe.router)
