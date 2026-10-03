from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT / ".env", Path.cwd() / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Qubrix"
    app_tagline: str = "AI-powered GATE prep"
    app_env: Literal["development", "staging", "production"] = "development"
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    secret_key: str = "dev-only-change-me"
    access_token_expire_minutes: int = 60 * 24  # 1 day
    refresh_token_expire_days: int = 14

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/gatepilot"

    google_client_id: str = ""
    google_client_secret: str = ""

    ai_provider: Literal["openai", "azure_openai", "stub"] = "stub"
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_vision_model: str = "gpt-5-mini"
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_deployment: str = ""

    ocr_provider: Literal["azure", "vision_llm", "stub"] = "stub"
    azure_document_intelligence_endpoint: str = ""
    azure_document_intelligence_key: str = ""

    storage_provider: Literal["local", "s3"] = "local"
    local_storage_dir: str = "storage"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket: str = ""
    s3_endpoint_url: str = ""

    redis_url: str = "redis://localhost:6379/0"
    starter_credits: int = 75
    max_upload_mb: int = 8
    cors_origins: str = "http://localhost:3000"

    # Langfuse — leave keys empty to disable tracing
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_base_url: str = "https://cloud.langfuse.com"

    # Dodo Payments — test_mode until live checkout is turned on
    dodo_payments_api_key: str = ""
    dodo_webhook_secret: str = ""
    dodo_environment: Literal["test_mode", "live_mode"] = "test_mode"
    dodo_product_starter: str = ""
    dodo_product_focus: str = ""
    dodo_product_intensive: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def google_oauth_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
