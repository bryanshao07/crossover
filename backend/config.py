from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: Optional[str] = None
    exports_dir: str = str(_REPO_ROOT / "exports")
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    database_url: str = "postgresql://postgres:postgres@localhost:5432/crossover"
    jwt_secret_key: str = "change-me-in-dot-env"


settings = Settings()
