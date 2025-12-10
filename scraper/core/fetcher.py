"""High-performance async HTTP fetcher using aiohttp."""

import asyncio
import aiohttp
from aiohttp import ClientTimeout, TCPConnector, ClientSession
from typing import Optional, Tuple, Dict, List, Set
from urllib.parse import urljoin, urlparse
import logging
import ssl

from ..utils.retry import retry_with_backoff
from ..utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


class Fetcher:
    """
    High-performance async HTTP fetcher optimized for German websites.

    Features:
    - Connection pooling with keep-alive
    - DNS caching
    - Rate limiting via semaphore
    - Automatic retry with exponential backoff
    - SSL verification (configurable)
    """

    # Common Impressum URL patterns for German websites
    IMPRESSUM_PATTERNS = [
        "/impressum",
        "/impressum.html",
        "/impressum.php",
        "/impressum/",
        "/imprint",
        "/imprint.html",
        "/legal",
        "/legal-notice",
        "/rechtliches",
        "/kontakt",
        "/kontakt.html",
        "/contact",
        "/about",
        "/about-us",
        "/ueber-uns",
    ]

    # User agent that works well with German websites
    DEFAULT_USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    def __init__(
        self,
        max_concurrent: int = 100,
        timeout: int = 15,
        dns_cache_ttl: int = 300,
        verify_ssl: bool = False,
    ):
        """
        Initialize the fetcher.

        Args:
            max_concurrent: Maximum concurrent connections
            timeout: Request timeout in seconds
            dns_cache_ttl: DNS cache TTL in seconds
            verify_ssl: Whether to verify SSL certificates
        """
        self._max_concurrent = max_concurrent
        self._timeout = timeout
        self._dns_cache_ttl = dns_cache_ttl
        self._verify_ssl = verify_ssl
        self._rate_limiter = RateLimiter(max_concurrent=max_concurrent)
        self._session: Optional[ClientSession] = None

    async def _get_session(self) -> ClientSession:
        """Get or create aiohttp session with optimized settings."""
        if self._session is None or self._session.closed:
            # SSL context
            if self._verify_ssl:
                ssl_context = ssl.create_default_context()
            else:
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE

            # Connector with connection pooling and DNS cache
            connector = TCPConnector(
                limit=self._max_concurrent,
                limit_per_host=10,
                ttl_dns_cache=self._dns_cache_ttl,
                ssl=ssl_context,
                keepalive_timeout=30,
                enable_cleanup_closed=True,
            )

            # Timeout configuration
            timeout = ClientTimeout(
                total=self._timeout,
                connect=5,
                sock_read=self._timeout,
            )

            # Headers
            headers = {
                "User-Agent": self.DEFAULT_USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
            }

            self._session = ClientSession(
                connector=connector,
                timeout=timeout,
                headers=headers,
            )

        return self._session

    @retry_with_backoff(
        max_retries=3,
        base_delay=0.5,
        exceptions=(aiohttp.ClientError, asyncio.TimeoutError),
    )
    async def fetch(self, url: str) -> Tuple[str, int]:
        """
        Fetch a URL and return content and status code.

        Args:
            url: URL to fetch

        Returns:
            Tuple of (HTML content, status code)
        """
        async with self._rate_limiter.acquire():
            session = await self._get_session()

            async with session.get(url, allow_redirects=True) as response:
                # Read content
                content = await response.text(errors="replace")
                return content, response.status

    async def fetch_with_impressum(
        self,
        url: str,
    ) -> Tuple[str, Optional[str], List[str]]:
        """
        Fetch a website and find its Impressum page.

        Strategy:
        1. Fetch main page and look for Impressum links
        2. If not found, try common Impressum URL patterns
        3. Fetch Impressum page if found

        Args:
            url: Base URL of the website

        Returns:
            Tuple of (impressum_content, impressum_url, pages_checked)
        """
        pages_checked = []

        # Normalize URL
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        try:
            # Step 1: Fetch main page
            main_content, status = await self.fetch(url)
            pages_checked.append(url)

            if status != 200:
                return "", None, pages_checked

            # Step 2: Find Impressum link in main page
            impressum_url = self._find_impressum_link(main_content, base_url)

            if impressum_url:
                # Fetch Impressum page
                try:
                    impressum_content, imp_status = await self.fetch(impressum_url)
                    pages_checked.append(impressum_url)

                    if imp_status == 200:
                        return impressum_content, impressum_url, pages_checked
                except Exception as e:
                    logger.debug(f"Failed to fetch impressum {impressum_url}: {e}")

            # Step 3: Try common patterns
            for pattern in self.IMPRESSUM_PATTERNS:
                test_url = urljoin(base_url, pattern)

                if test_url in pages_checked:
                    continue

                try:
                    content, status = await self.fetch(test_url)
                    pages_checked.append(test_url)

                    if status == 200:
                        return content, test_url, pages_checked
                except Exception:
                    continue

            # Fallback: Return main page content
            return main_content, url, pages_checked

        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return "", None, pages_checked

    def _find_impressum_link(self, html_content: str, base_url: str) -> Optional[str]:
        """
        Find Impressum link in HTML content.

        Uses simple regex to avoid BeautifulSoup dependency in fetcher.
        """
        import re

        # Pattern to find links with Impressum-related text or href
        link_pattern = r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>([^<]*(?:impressum|imprint|legal)[^<]*)</a>'

        matches = re.findall(link_pattern, html_content, re.IGNORECASE)

        for href, text in matches:
            if href.startswith("http"):
                return href
            elif href.startswith("/"):
                return urljoin(base_url, href)
            elif not href.startswith(("#", "javascript:", "mailto:")):
                return urljoin(base_url, "/" + href)

        # Also check href attributes directly
        href_pattern = r'href=["\']([^"\']*(?:impressum|imprint|legal)[^"\']*)["\']'
        href_matches = re.findall(href_pattern, html_content, re.IGNORECASE)

        for href in href_matches:
            if href.startswith("http"):
                return href
            elif href.startswith("/"):
                return urljoin(base_url, href)
            elif not href.startswith(("#", "javascript:", "mailto:")):
                return urljoin(base_url, "/" + href)

        return None

    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
