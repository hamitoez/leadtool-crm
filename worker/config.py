"""
Configuration module for the scraping worker.
Loads settings from environment variables with sensible defaults.
"""

import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables from .env file
load_dotenv()


class Config:
    """Configuration settings for the scraping worker."""

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/leadtool?schema=public"
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    REDIS_QUEUE_NAME: str = os.getenv("REDIS_QUEUE_NAME", "extraction-queue")

    # Anthropic API
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    ANTHROPIC_MAX_TOKENS: int = int(os.getenv("ANTHROPIC_MAX_TOKENS", "2000"))

    # Rate limiting
    RATE_LIMIT_REQUESTS_PER_SECOND: float = float(
        os.getenv("RATE_LIMIT_REQUESTS_PER_SECOND", "2.0")
    )
    RATE_LIMIT_BURST: int = int(os.getenv("RATE_LIMIT_BURST", "5"))

    # HTTP client settings
    HTTP_TIMEOUT: int = int(os.getenv("HTTP_TIMEOUT", "15"))
    HTTP_MAX_REDIRECTS: int = int(os.getenv("HTTP_MAX_REDIRECTS", "5"))
    HTTP_POOL_CONNECTIONS: int = int(os.getenv("HTTP_POOL_CONNECTIONS", "10"))
    HTTP_POOL_MAXSIZE: int = int(os.getenv("HTTP_POOL_MAXSIZE", "20"))

    # Concurrency
    MAX_CONCURRENT_DOMAINS: int = int(os.getenv("MAX_CONCURRENT_DOMAINS", "3"))
    MAX_CONCURRENT_PAGES_PER_DOMAIN: int = int(
        os.getenv("MAX_CONCURRENT_PAGES_PER_DOMAIN", "2")
    )

    # Retry settings
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "3"))
    RETRY_DELAY: float = float(os.getenv("RETRY_DELAY", "2.0"))

    # User agents (rotate between these)
    USER_AGENTS: list = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    ]

    # Discovery patterns for relevant pages
    DISCOVERY_PATTERNS: dict = {
        "impressum": [
            r"/impressum",
            r"/imprint",
            r"/legal",
            r"/about/legal",
        ],
        "kontakt": [
            r"/kontakt",
            r"/contact",
            r"/contact-us",
            r"/get-in-touch",
        ],
        "team": [
            r"/team",
            r"/about/team",
            r"/our-team",
            r"/about-us",
        ],
        "about": [
            r"/about",
            r"/uber-uns",
            r"/ueber-uns",
            r"/company",
        ],
    }

    # Link text patterns for discovery
    DISCOVERY_LINK_TEXT: dict = {
        "impressum": ["impressum", "imprint", "legal notice"],
        "kontakt": ["kontakt", "contact", "get in touch"],
        "team": ["team", "our team", "about us"],
        "about": ["about", "über uns", "about us"],
    }

    # Validation settings
    MIN_CONFIDENCE_THRESHOLD: float = float(
        os.getenv("MIN_CONFIDENCE_THRESHOLD", "0.3")
    )

    # LLM fallback settings
    ENABLE_LLM_FALLBACK: bool = os.getenv("ENABLE_LLM_FALLBACK", "true").lower() == "true"
    LLM_FALLBACK_ON_LOW_CONFIDENCE: bool = os.getenv(
        "LLM_FALLBACK_ON_LOW_CONFIDENCE", "true"
    ).lower() == "true"
    LLM_CONFIDENCE_THRESHOLD: float = float(
        os.getenv("LLM_CONFIDENCE_THRESHOLD", "0.5")
    )

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    @classmethod
    def validate(cls) -> bool:
        """Validate required configuration is present."""
        if not cls.DATABASE_URL:
            raise ValueError("DATABASE_URL is required")
        if not cls.REDIS_URL:
            raise ValueError("REDIS_URL is required")
        if cls.ENABLE_LLM_FALLBACK and not cls.ANTHROPIC_API_KEY:
            raise ValueError(
                "ANTHROPIC_API_KEY is required when LLM fallback is enabled"
            )
        return True


# Validate configuration on import
Config.validate()
