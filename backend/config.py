"""
Nova AI - Application configuration.
Reads from environment variables / .env file. All AI calls degrade gracefully
to a local heuristic pipeline when GEMINI_API_KEY is not set, so the product
is fully demoable without live credentials.
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Nova AI"
    ENV: str = os.getenv("ENV", "development")

    # Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "nova-ai-dev-secret-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./storage/nova.db")

    # Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_EMBED_MODEL: str = os.getenv("GEMINI_EMBED_MODEL", "text-embedding-004")
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"

    # Tavily
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    # Storage
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    VECTOR_STORE_DIR: str = os.getenv("VECTOR_STORE_DIR", "./storage/vectors")

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "*"]

    class Config:
        env_file = ".env"

    @property
    def ai_enabled(self) -> bool:
        return bool(self.GEMINI_API_KEY)


@lru_cache
def get_settings() -> Settings:
    return Settings()
