from pathlib import Path
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: Optional[str] = None
    # Single source of truth for the Gemini model ids. The embedding model MUST
    # be identical for the offline document build (scripts/build_rag.py) and the
    # runtime query embedding (services/rag.py) — a mismatch makes cosine
    # similarity meaningless. Override per-account via env if a model id retires.
    gemini_card_model: str = "gemini-flash-latest"
    gemini_embed_model: str = "models/gemini-embedding-001"
    exports_dir: str = str(_REPO_ROOT / "exports")
    uploads_dir: str = str(_REPO_ROOT / "uploads")
    # Single source of truth for allowed CORS origins (main.py reads this).
    # Override per-deploy with the CORS_ORIGINS env var (JSON list).
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://crossover-ten-theta.vercel.app",
    ]
    database_url: str = "postgresql://postgres:postgres@localhost:5432/crossover"
    # Required: no default. A missing JWT_SECRET_KEY raises at startup rather than
    # silently signing tokens with a publicly-known key (which would be forgeable).
    jwt_secret_key: str
    # Fail secure: default to production so an undeclared environment gets secure
    # cookies. Local http dev must opt out explicitly with ENVIRONMENT=development.
    environment: str = "production"

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        # Render (and Heroku) hand out connection strings with the legacy
        # "postgres://" scheme, but SQLAlchemy 2.x only recognizes
        # "postgresql://" and raises NoSuchModuleError at create_engine() on the
        # former. Rewrite it so the platform URL can be pasted in verbatim.
        if value.startswith("postgres://"):
            return "postgresql://" + value[len("postgres://") :]
        return value


settings = Settings()
