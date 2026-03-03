from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "unified-workspace"
    DEBUG: bool = False
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://workspace_user:workspace_pass@db:5432/workspace"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # n8n
    N8N_BASE_URL: str = "http://n8n:5678"
    N8N_WEBHOOK_BASE: str = "http://n8n:5678/webhook"
    N8N_API_KEY: str | None = None
    N8N_CALLBACK_SECRET: str = "n8n-callback-secret-change-me"

    # LLM (Dataset Summary)
    GEMINI_API_KEY: str | None = None
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: str | None = None
    OPENAI_BASE_URL: str | None = None
    OPENAI_MODEL: str | None = None
    MOCK_MODE: str = "0"

    # Auth
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
