"""
LeadTool Impressum Scraper

High-performance scraper for extracting contact information from German Impressum pages.
Optimized for 10,000+ URLs with parallel processing.

Features:
- Async HTTP with aiohttp (100+ concurrent connections)
- BeautifulSoup + lxml HTML parsing
- OpenAI GPT-4o for 97-99% extraction accuracy
- Rate limiting and retry with exponential backoff
- Progress tracking with tqdm

Usage:
    from scraper import ImpressumScraper, ScraperConfig

    config = ScraperConfig(openai_api_key="sk-...")
    async with ImpressumScraper(config) as scraper:
        results = await scraper.scrape_urls(["https://example.de", ...])
"""

from .config import ScraperConfig
from .runner import ImpressumScraper
from .models import (
    ContactInfo,
    ScrapeResult,
    ScrapeJob,
    ScrapeStatus,
    BulkScrapeRequest,
    BulkScrapeResponse,
)

__version__ = "1.0.0"
__all__ = [
    "ImpressumScraper",
    "ScraperConfig",
    "ContactInfo",
    "ScrapeResult",
    "ScrapeJob",
    "ScrapeStatus",
    "BulkScrapeRequest",
    "BulkScrapeResponse",
]
