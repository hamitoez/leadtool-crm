# -*- coding: utf-8 -*-
"""Configuration management for the Impressum scraper.

This module provides centralized configuration with support for:
- Environment variables
- User settings from database
- Multi-provider LLM configuration
- Security settings with SSL verification
"""

from typing import Optional, Literal
from dataclasses import dataclass, field
import os
import logging
import warnings

logger = logging.getLogger(__name__)


@dataclass
class ScraperConfig:
    """
    Configuration for the Impressum scraper.

    Designed to integrate with the existing LeadTool settings system.
    API keys are retrieved from user settings, not environment variables.

    Attributes:
        openai_api_key: OpenAI API key for GPT-4o extraction
        anthropic_api_key: Anthropic API key for Claude extraction
        ollama_base_url: Base URL for local Ollama instance
        llm_provider: Which LLM provider to use
        model: Model identifier for the selected provider
        verify_ssl: Enable SSL certificate verification (recommended: True)
        ssl_ca_bundle: Custom CA bundle path for enterprise proxies
    """

    # LLM Provider Configuration
    llm_provider: Literal["openai", "anthropic", "ollama"] = "openai"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ollama_base_url: str = "http://localhost:11434"
    model: str = "gpt-4o"

    # HTTP Configuration
    http_concurrency: int = 100
    http_timeout: int = 15
    dns_cache_ttl: int = 300

    # Security Configuration - SSL enabled by default
    verify_ssl: bool = True
    ssl_ca_bundle: Optional[str] = None

    # Fetcher Configuration
    respect_robots: bool = True
    enable_cache: bool = True

    # LLM Configuration
    llm_concurrency: int = 50
    llm_temperature: float = 0.0
    llm_max_tokens: int = 500
    max_text_length: int = 4000

    # Retry Configuration
    max_retries: int = 3
    retry_base_delay: float = 0.5
    retry_max_delay: float = 30.0

    # Job Management Configuration
    job_retention_seconds: int = 3600
    max_stored_jobs: int = 1000

    # Server Configuration
    host: str = "127.0.0.1"
    port: int = 8765

    def __post_init__(self):
        """Validate configuration after initialization."""
        # Warn if SSL verification is disabled
        if not self.verify_ssl:
            warnings.warn(
                "SSL verification is disabled. This is a security risk and "
                "should only be used in development environments.",
                SecurityWarning,
                stacklevel=2,
            )
            logger.warning(
                "SSL verification disabled - vulnerable to MITM attacks. "
                "Set verify_ssl=True for production use."
            )

        # Validate custom CA bundle if provided
        if self.ssl_ca_bundle and not os.path.isfile(self.ssl_ca_bundle):
            raise ValueError(f"SSL CA bundle not found: {self.ssl_ca_bundle}")

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
        # Determine LLM provider
        provider = settings.get("llm_provider", "openai")
        if provider == "anthropic" and settings.get("anthropic_api_key"):
            llm_provider = "anthropic"
        elif provider == "ollama":
            llm_provider = "ollama"
        else:
            llm_provider = "openai"

        return cls(
            # LLM settings
            llm_provider=llm_provider,
            openai_api_key=settings.get("aiApiKey") or settings.get("openai_api_key"),
            anthropic_api_key=settings.get("anthropic_api_key"),
            ollama_base_url=settings.get("ollama_base_url", "http://localhost:11434"),
            model=settings.get("aiModel") or settings.get("scraper_model", "gpt-4o"),

            # HTTP settings
            http_concurrency=settings.get("scraper_http_concurrency", 100),
            llm_concurrency=settings.get("scraper_llm_concurrency", 50),
            http_timeout=settings.get("scraper_http_timeout", 15),
            max_text_length=settings.get("scraper_max_text_length", 4000),

            # Security settings - default to True
            verify_ssl=settings.get("verify_ssl", True),
            ssl_ca_bundle=settings.get("ssl_ca_bundle"),

            # Job settings
            job_retention_seconds=settings.get("job_retention_seconds", 3600),
            max_stored_jobs=settings.get("max_stored_jobs", 1000),
        )

    @classmethod
    def from_env(cls) -> "ScraperConfig":
        """
        Create config from environment variables.

        Used for standalone operation or testing.
        """
        # Parse verify_ssl - default to True for security
        verify_ssl_env = os.getenv("SCRAPER_VERIFY_SSL", "true").lower()
        verify_ssl = verify_ssl_env not in ("false", "0", "no", "off")

        return cls(
            # LLM settings
            llm_provider=os.getenv("LLM_PROVIDER", "openai"),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            model=os.getenv("SCRAPER_MODEL", "gpt-4o"),

            # HTTP settings
            http_concurrency=int(os.getenv("SCRAPER_HTTP_CONCURRENCY", "100")),
            llm_concurrency=int(os.getenv("SCRAPER_LLM_CONCURRENCY", "50")),
            http_timeout=int(os.getenv("SCRAPER_HTTP_TIMEOUT", "15")),

            # Security settings
            verify_ssl=verify_ssl,
            ssl_ca_bundle=os.getenv("SSL_CA_BUNDLE"),

            # Job settings
            job_retention_seconds=int(os.getenv("JOB_RETENTION_SECONDS", "3600")),
            max_stored_jobs=int(os.getenv("MAX_STORED_JOBS", "1000")),

            # Server settings
            host=os.getenv("SCRAPER_HOST", "127.0.0.1"),
            port=int(os.getenv("SCRAPER_PORT", "8765")),
        )

    def validate(self) -> bool:
        """
        Validate the configuration.

        Returns:
            True if valid, raises ValueError if not
        """
        # Check API key for selected provider
        if self.llm_provider == "openai" and not self.openai_api_key:
            raise ValueError("OpenAI API key is required when using OpenAI provider")

        if self.llm_provider == "anthropic" and not self.anthropic_api_key:
            raise ValueError("Anthropic API key is required when using Anthropic provider")

        if self.http_concurrency < 1 or self.http_concurrency > 500:
            raise ValueError("HTTP concurrency must be between 1 and 500")

        if self.llm_concurrency < 1 or self.llm_concurrency > 200:
            raise ValueError("LLM concurrency must be between 1 and 200")

        if self.job_retention_seconds < 60:
            raise ValueError("Job retention must be at least 60 seconds")

        if self.max_stored_jobs < 10:
            raise ValueError("Max stored jobs must be at least 10")

        return True

    @property
    def has_api_key(self) -> bool:
        """Check if API key is configured for selected provider."""
        if self.llm_provider == "openai":
            return bool(self.openai_api_key)
        elif self.llm_provider == "anthropic":
            return bool(self.anthropic_api_key)
        elif self.llm_provider == "ollama":
            return True  # Ollama doesn't require API key
        return False

    @property
    def active_api_key(self) -> Optional[str]:
        """Get the API key for the active provider."""
        if self.llm_provider == "openai":
            return self.openai_api_key
        elif self.llm_provider == "anthropic":
            return self.anthropic_api_key
        return None

    def get_masked_api_key(self) -> str:
        """Get masked version of API key for logging."""
        key = self.active_api_key
        if not key:
            return "not-set"
        if len(key) <= 8:
            return "***"
        return f"{key[:4]}...{key[-4:]}"


# Default configuration instance
default_config = ScraperConfig()
