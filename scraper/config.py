"""Configuration management for the Impressum scraper."""

from typing import Optional
from dataclasses import dataclass, field
import os
import logging

logger = logging.getLogger(__name__)


@dataclass
class ScraperConfig:
    """
    Configuration for the Impressum scraper.

    Designed to integrate with the existing LeadTool settings system.
    API keys are retrieved from user settings, not environment variables.
    """

    # API Configuration (from user settings)
    openai_api_key: Optional[str] = None
    model: str = "gpt-4o"

    # HTTP Configuration
    http_concurrency: int = 100
    http_timeout: int = 15
    dns_cache_ttl: int = 300
    verify_ssl: bool = False

    # LLM Configuration
    llm_concurrency: int = 50
    llm_temperature: float = 0.0
    llm_max_tokens: int = 500
    max_text_length: int = 4000

    # Retry Configuration
    max_retries: int = 3
    retry_base_delay: float = 0.5
    retry_max_delay: float = 30.0

    # Server Configuration
    host: str = "127.0.0.1"
    port: int = 8765

    @classmethod
    def from_user_settings(cls, settings: dict) -> "ScraperConfig":
        """
        Create config from user settings dictionary.

        This method is called from the Next.js backend when a user
        initiates a scraping job. The settings come from the database.

        Args:
            settings: Dict with user settings from database

        Returns:
            ScraperConfig instance
        """
        return cls(
            openai_api_key=settings.get("aiApiKey") or settings.get("openai_api_key"),
            model=settings.get("aiModel") or settings.get("scraper_model", "gpt-4o"),
            http_concurrency=settings.get("scraper_http_concurrency", 100),
            llm_concurrency=settings.get("scraper_llm_concurrency", 50),
            http_timeout=settings.get("scraper_http_timeout", 15),
            max_text_length=settings.get("scraper_max_text_length", 4000),
        )

    @classmethod
    def from_env(cls) -> "ScraperConfig":
        """
        Create config from environment variables.

        Used for standalone operation or testing.
        """
        return cls(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model=os.getenv("SCRAPER_MODEL", "gpt-4o"),
            http_concurrency=int(os.getenv("SCRAPER_HTTP_CONCURRENCY", "100")),
            llm_concurrency=int(os.getenv("SCRAPER_LLM_CONCURRENCY", "50")),
            http_timeout=int(os.getenv("SCRAPER_HTTP_TIMEOUT", "15")),
            host=os.getenv("SCRAPER_HOST", "127.0.0.1"),
            port=int(os.getenv("SCRAPER_PORT", "8765")),
        )

    def validate(self) -> bool:
        """
        Validate the configuration.

        Returns:
            True if valid, raises ValueError if not
        """
        if not self.openai_api_key:
            raise ValueError("OpenAI API key is required for LLM extraction")

        if self.http_concurrency < 1 or self.http_concurrency > 500:
            raise ValueError("HTTP concurrency must be between 1 and 500")

        if self.llm_concurrency < 1 or self.llm_concurrency > 200:
            raise ValueError("LLM concurrency must be between 1 and 200")

        return True

    @property
    def has_api_key(self) -> bool:
        """Check if API key is configured."""
        return bool(self.openai_api_key)


# Default configuration instance
default_config = ScraperConfig()
