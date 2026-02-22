"""
Configuration — environment variables only.
Never store keys in code.
"""

import os


class Settings:
    # Supabase
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    # Ollama (local)
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434")

    # OpenRouter (market)
    OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.environ.get(
        "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
    )

    # Claude / Anthropic (premium)
    ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")

    # Service
    PORT: int = int(os.environ.get("ROUTER_PORT", "8100"))
    LOG_LEVEL: str = os.environ.get("LOG_LEVEL", "INFO")


settings = Settings()
