"""
Application configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase Cloud
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your-anon-key-here"

    # Serial / RFID
    ALLOWED_DRIVERS: str = "cp210"
    MOCK_SERIAL: bool = False

    # Sync Worker
    SYNC_LOOP_INTERVAL_SECONDS: int = 30
    SYNC_MAX_RETRY_BEFORE_PERMANENT_FAIL: int = 10

    # HTTP Timeouts
    HTTPX_TIMEOUT_SYNC_SECONDS: int = 10
    HTTPX_TIMEOUT_ADMIN_SECONDS: int = 15

    # Database
    DATABASE_URL: str = "sqlite:///./local.db"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
