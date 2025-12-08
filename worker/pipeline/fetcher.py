"""
HTTP fetching module with rate limiting and connection pooling.
Uses httpx for async HTTP requests with proper error handling.
"""

import asyncio
import logging
import random
from typing import Optional, Dict
from dataclasses import dataclass
from datetime import datetime
import httpx
from collections import defaultdict

from config import Config
from pipeline.normalizer import get_domain

logger = logging.getLogger(__name__)


@dataclass
class FetchResult:
    """Result of a fetch operation."""
    url: str
    success: bool
    status_code: Optional[int] = None
    content: Optional[str] = None
    content_type: Optional[str] = None
    html: Optional[str] = None
    text: Optional[str] = None
    fetch_time_ms: int = 0
    error: Optional[str] = None
    redirected_to: Optional[str] = None


class RateLimiter:
    """Rate limiter per domain."""

    def __init__(self, requests_per_second: float = 2.0):
        """Initialize rate limiter."""
        self.requests_per_second = requests_per_second
        self.last_request: Dict[str, float] = defaultdict(float)
        self.lock = asyncio.Lock()

    async def wait_if_needed(self, domain: str):
        """Wait if rate limit would be exceeded."""
        async with self.lock:
            now = asyncio.get_event_loop().time()
            time_since_last = now - self.last_request[domain]
            min_interval = 1.0 / self.requests_per_second

            if time_since_last < min_interval:
                wait_time = min_interval - time_since_last
                logger.debug(f"Rate limiting {domain}: waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)

            self.last_request[domain] = asyncio.get_event_loop().time()


class Fetcher:
    """Async HTTP client with rate limiting and connection pooling."""

    def __init__(self):
        """Initialize fetcher."""
        self.client: Optional[httpx.AsyncClient] = None
        self.rate_limiter = RateLimiter(
            requests_per_second=Config.RATE_LIMIT_REQUESTS_PER_SECOND
        )

    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def start(self):
        """Start the HTTP client."""
        if self.client is None:
            # Configure limits for connection pooling
            limits = httpx.Limits(
                max_keepalive_connections=Config.HTTP_POOL_CONNECTIONS,
                max_connections=Config.HTTP_POOL_MAXSIZE,
            )

            # Configure timeout
            timeout = httpx.Timeout(
                timeout=Config.HTTP_TIMEOUT,
                connect=5.0,
            )

            # Create client
            self.client = httpx.AsyncClient(
                limits=limits,
                timeout=timeout,
                follow_redirects=True,
                max_redirects=Config.HTTP_MAX_REDIRECTS,
                http2=True,
            )
            logger.info("HTTP client started with connection pooling")

    async def close(self):
        """Close the HTTP client."""
        if self.client:
            await self.client.aclose()
            self.client = None
            logger.info("HTTP client closed")

    def _get_user_agent(self) -> str:
        """Get a random user agent."""
        return random.choice(Config.USER_AGENTS)

    async def fetch(self, url: str) -> FetchResult:
        """
        Fetch a URL with rate limiting and error handling.

        Args:
            url: URL to fetch

        Returns:
            FetchResult with response data
        """
        if not self.client:
            await self.start()

        # Extract domain for rate limiting
        domain = get_domain(url)
        if domain:
            await self.rate_limiter.wait_if_needed(domain)

        start_time = datetime.now()

        try:
            # Prepare headers
            headers = {
                'User-Agent': self._get_user_agent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }

            # Make request
            response = await self.client.get(url, headers=headers)

            # Calculate fetch time
            fetch_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            # Get content type
            content_type = response.headers.get('Content-Type', '')

            # Check if HTML
            if 'text/html' in content_type.lower():
                html = response.text
                text = html  # Will be processed later for text extraction
            else:
                html = None
                text = None

            # Get final URL after redirects
            final_url = str(response.url)
            redirected_to = final_url if final_url != url else None

            logger.info(
                f"Fetched {url} -> {response.status_code} ({fetch_time_ms}ms)"
            )

            return FetchResult(
                url=url,
                success=response.status_code == 200,
                status_code=response.status_code,
                content=response.text if response.status_code == 200 else None,
                content_type=content_type,
                html=html,
                text=text,
                fetch_time_ms=fetch_time_ms,
                redirected_to=redirected_to,
            )

        except httpx.TimeoutException as e:
            fetch_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.warning(f"Timeout fetching {url}: {e}")
            return FetchResult(
                url=url,
                success=False,
                fetch_time_ms=fetch_time_ms,
                error=f"Timeout: {str(e)}",
            )

        except httpx.HTTPError as e:
            fetch_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.warning(f"HTTP error fetching {url}: {e}")
            return FetchResult(
                url=url,
                success=False,
                fetch_time_ms=fetch_time_ms,
                error=f"HTTP error: {str(e)}",
            )

        except Exception as e:
            fetch_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"Error fetching {url}: {e}", exc_info=True)
            return FetchResult(
                url=url,
                success=False,
                fetch_time_ms=fetch_time_ms,
                error=f"Error: {str(e)}",
            )

    async def fetch_many(self, urls: list[str]) -> Dict[str, FetchResult]:
        """
        Fetch multiple URLs concurrently with rate limiting.

        Args:
            urls: List of URLs to fetch

        Returns:
            Dict mapping URL to FetchResult
        """
        tasks = [self.fetch(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Build result dict
        result_dict = {}
        for url, result in zip(urls, results):
            if isinstance(result, Exception):
                logger.error(f"Exception fetching {url}: {result}")
                result_dict[url] = FetchResult(
                    url=url,
                    success=False,
                    error=str(result),
                )
            else:
                result_dict[url] = result

        return result_dict
