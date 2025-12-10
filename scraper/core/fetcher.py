# -*- coding: utf-8 -*-
"""High-performance async HTTP fetcher using aiohttp.

This module provides optimized HTTP fetching for German websites,
with support for SSL verification, custom CA bundles,
automatic Impressum page discovery, response caching, and robots.txt respect.
"""

import asyncio
import ssl
import certifi
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Optional, Tuple, List, Dict
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import aiohttp
from aiohttp import ClientTimeout, TCPConnector, ClientSession
from aiohttp.resolver import AsyncResolver
import structlog

from ..utils.retry import retry_with_backoff
from ..utils.rate_limiter import RateLimiter

logger = structlog.get_logger(__name__)


@dataclass
class CacheEntry:
    """Cache entry for storing fetched responses."""
    content: str
    status: int
    timestamp: float


class Fetcher:
    """
    High-performance async HTTP fetcher optimized for German websites.

    Features:
    - Connection pooling with keep-alive
    - DNS caching with async resolver
    - Rate limiting via semaphore
    - Automatic retry with exponential backoff
    - Configurable SSL verification with custom CA bundle support
    - Automatic Impressum page discovery
    - Response caching with LRU eviction
    - Optional robots.txt compliance

    Example:
        async with Fetcher(verify_ssl=True) as fetcher:
            content, status = await fetcher.fetch("https://example.de")
            impressum, url, pages = await fetcher.fetch_with_impressum("https://example.de")
    """

    # Cache configuration
    CACHE_TTL = 300  # 5 minutes
    CACHE_MAX_SIZE = 1000

    # Common Impressum URL patterns for German/Austrian/Swiss websites
    IMPRESSUM_PATTERNS = [
        # German standard
        "/impressum",
        "/impressum.html",
        "/impressum.php",
        "/impressum/",
        "/imprint",
        "/imprint.html",
        "/legal",
        "/legal-notice",
        "/rechtliches",
        # Contact pages
        "/kontakt",
        "/kontakt.html",
        "/kontakt/",
        "/contact",
        "/contact/",
        "/contact-us",
        "/get-in-touch",
        # About pages
        "/about",
        "/about-us",
        "/ueber-uns",
        "/about/",
        # Team/Person pages
        "/ansprechpartner",
        "/team",
        "/team/",
        # Austrian specific
        "/offenlegung",
        # Combined pages
        "/impressum-datenschutz",
        "/agb-impressum",
        "/datenschutz-impressum",
        # English variations
        "/legal-notice/",
        "/privacy-imprint",
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
        verify_ssl: bool = True,
        ssl_ca_bundle: Optional[str] = None,
        respect_robots: bool = True,
        enable_cache: bool = True,
    ):
        """
        Initialize the fetcher.

        Args:
            max_concurrent: Maximum concurrent connections
            timeout: Request timeout in seconds
            dns_cache_ttl: DNS cache TTL in seconds
            verify_ssl: Whether to verify SSL certificates (recommended: True)
            ssl_ca_bundle: Path to custom CA bundle for enterprise proxies
            respect_robots: Whether to respect robots.txt (default: True)
            enable_cache: Whether to enable response caching (default: True)
        """
        self._max_concurrent = max_concurrent
        self._timeout = timeout
        self._dns_cache_ttl = dns_cache_ttl
        self._verify_ssl = verify_ssl
        self._ssl_ca_bundle = ssl_ca_bundle
        self._respect_robots = respect_robots
        self._enable_cache = enable_cache
        self._rate_limiter = RateLimiter(max_concurrent=max_concurrent)
        self._session: Optional[ClientSession] = None
        self._log = logger.bind(verify_ssl=verify_ssl)

        # Response cache (LRU)
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._cache_hits = 0
        self._cache_misses = 0

        # Robots.txt cache
        self._robots_cache: Dict[str, Optional[RobotFileParser]] = {}

        # Log security warning if SSL is disabled
        if not verify_ssl:
            self._log.warning(
                "ssl_verification_disabled",
                message="SSL verification is disabled - vulnerable to MITM attacks",
            )

    def _create_ssl_context(self) -> ssl.SSLContext:
        """
        Create SSL context based on configuration.

        Returns:
            Configured SSL context
        """
        if not self._verify_ssl:
            # Insecure context - only for development
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            return context

        # Secure context with certificate verification
        if self._ssl_ca_bundle:
            # Use custom CA bundle
            context = ssl.create_default_context(cafile=self._ssl_ca_bundle)
        else:
            # Use certifi's CA bundle for maximum compatibility
            context = ssl.create_default_context(cafile=certifi.where())

        return context

    async def _get_session(self) -> ClientSession:
        """Get or create aiohttp session with optimized settings."""
        if self._session is None or self._session.closed:
            ssl_context = self._create_ssl_context()

            # Async DNS resolver with fallback to public DNS
            # Helps with slow/unresponsive corporate DNS servers
            try:
                resolver = AsyncResolver(nameservers=["8.8.8.8", "1.1.1.1"])
            except Exception:
                # Fallback to default resolver if async resolver fails
                resolver = None

            # Connector with connection pooling and DNS cache
            connector = TCPConnector(
                limit=self._max_concurrent,
                limit_per_host=10,
                ttl_dns_cache=self._dns_cache_ttl,
                ssl=ssl_context,
                keepalive_timeout=30,
                enable_cleanup_closed=True,
                resolver=resolver,
            )

            # Timeout configuration with separate connection timeouts
            # This prevents hanging on dead domains or slow DNS
            timeout = ClientTimeout(
                total=self._timeout,      # 15s total request timeout
                connect=5,                # 5s for TCP connection
                sock_connect=5,           # 5s for socket connection
                sock_read=self._timeout,  # 15s for reading response
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

    def _get_from_cache(self, url: str) -> Optional[Tuple[str, int]]:
        """Get response from cache if available and not expired."""
        if not self._enable_cache:
            return None

        entry = self._cache.get(url)
        if entry is None:
            self._cache_misses += 1
            return None

        if time.monotonic() - entry.timestamp > self.CACHE_TTL:
            del self._cache[url]
            self._cache_misses += 1
            return None

        # Move to end (LRU)
        self._cache.move_to_end(url)
        self._cache_hits += 1
        return entry.content, entry.status

    def _add_to_cache(self, url: str, content: str, status: int) -> None:
        """Add response to cache with LRU eviction."""
        if not self._enable_cache:
            return

        # LRU: Remove oldest entries if cache is full
        while len(self._cache) >= self.CACHE_MAX_SIZE:
            self._cache.popitem(last=False)

        self._cache[url] = CacheEntry(
            content=content,
            status=status,
            timestamp=time.monotonic(),
        )

    @property
    def cache_stats(self) -> Dict[str, int]:
        """Get cache statistics for monitoring."""
        total = self._cache_hits + self._cache_misses
        return {
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": round(self._cache_hits / total * 100, 1) if total > 0 else 0,
            "size": len(self._cache),
        }

    async def _get_robots_parser(self, url: str) -> Optional[RobotFileParser]:
        """Load and cache robots.txt for a domain."""
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"

        if domain in self._robots_cache:
            return self._robots_cache[domain]

        robots_url = f"{domain}/robots.txt"

        try:
            # Fetch robots.txt without caching (handled separately)
            session = await self._get_session()
            async with session.get(robots_url, allow_redirects=True) as response:
                if response.status == 200:
                    content = await response.text(errors="replace")
                    parser = RobotFileParser()
                    parser.parse(content.splitlines())
                    self._robots_cache[domain] = parser
                    return parser
        except Exception:
            pass

        # No robots.txt = allow everything
        self._robots_cache[domain] = None
        return None

    async def is_allowed(self, url: str) -> bool:
        """Check if URL is allowed by robots.txt."""
        if not self._respect_robots:
            return True

        parser = await self._get_robots_parser(url)
        if parser is None:
            return True

        return parser.can_fetch(self.DEFAULT_USER_AGENT, url)

    @retry_with_backoff(
        max_retries=3,
        base_delay=0.5,
        exceptions=(aiohttp.ClientError, asyncio.TimeoutError),
    )
    async def fetch(self, url: str, use_cache: bool = True) -> Tuple[str, int]:
        """
        Fetch a URL and return content and status code.

        Args:
            url: URL to fetch
            use_cache: Whether to use cache for this request (default: True)

        Returns:
            Tuple of (HTML content, status code)

        Raises:
            aiohttp.ClientError: On network errors (after retries)
            asyncio.TimeoutError: On timeout (after retries)
        """
        # Check cache first
        if use_cache:
            cached = self._get_from_cache(url)
            if cached:
                return cached

        async with self._rate_limiter.acquire():
            session = await self._get_session()

            async with session.get(url, allow_redirects=True) as response:
                # Read content with encoding error handling
                content = await response.text(errors="replace")

                # Cache successful responses
                if use_cache and response.status == 200:
                    self._add_to_cache(url, content, response.status)

                return content, response.status

    async def fetch_with_impressum(
        self,
        url: str,
    ) -> Tuple[str, Optional[str], List[str]]:
        """
        Fetch a website and find its Impressum page.

        Strategy:
        1. Check robots.txt compliance
        2. Fetch main page and look for Impressum links
        3. If not found, try common Impressum URL patterns
        4. Fetch Impressum page if found

        Args:
            url: Base URL of the website

        Returns:
            Tuple of (impressum_content, impressum_url, pages_checked)
        """
        pages_checked = []
        log = self._log.bind(url=url)

        # Normalize URL
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        # Check robots.txt compliance
        if not await self.is_allowed(url):
            log.info("blocked_by_robots_txt", url=url)
            return "", None, pages_checked

        try:
            # Step 1: Fetch main page
            main_content, status = await self.fetch(url)
            pages_checked.append(url)

            if status != 200:
                log.debug("main_page_fetch_failed", status=status)
                return "", None, pages_checked

            # Step 2: Find Impressum link in main page
            impressum_url = self._find_impressum_link(main_content, base_url)

            if impressum_url:
                # Fetch Impressum page
                try:
                    impressum_content, imp_status = await self.fetch(impressum_url)
                    pages_checked.append(impressum_url)

                    if imp_status == 200:
                        log.debug("impressum_found", impressum_url=impressum_url)
                        return impressum_content, impressum_url, pages_checked
                except Exception as e:
                    log.debug("impressum_fetch_failed", impressum_url=impressum_url, error=str(e))

            # Step 3: Try common patterns
            for pattern in self.IMPRESSUM_PATTERNS:
                test_url = urljoin(base_url, pattern)

                if test_url in pages_checked:
                    continue

                try:
                    content, status = await self.fetch(test_url)
                    pages_checked.append(test_url)

                    if status == 200:
                        log.debug("impressum_found_via_pattern", impressum_url=test_url)
                        return content, test_url, pages_checked
                except Exception:
                    continue

            # Fallback: Return main page content
            log.debug("impressum_not_found_using_main_page")
            return main_content, url, pages_checked

        except Exception as e:
            log.error("fetch_error", error=str(e))
            return "", None, pages_checked

    # Keywords to search for in links (prioritized order)
    LINK_KEYWORDS = [
        # High priority - legal pages
        "impressum", "imprint", "legal",
        # Contact pages
        "kontakt", "contact",
        # About pages
        "about", "über uns", "ueber-uns", "über-uns",
        # Team/Person pages
        "ansprechpartner", "team",
        # Austrian specific
        "offenlegung",
    ]

    def _find_impressum_link(self, html_content: str, base_url: str) -> Optional[str]:
        """
        Find Impressum/Contact link in HTML content.

        Searches for links containing relevant keywords in both
        the href attribute and the link text. Keywords are checked
        in priority order.

        Args:
            html_content: HTML content to search
            base_url: Base URL for resolving relative links

        Returns:
            Absolute URL of found link, or None
        """
        import re

        # Pattern to find <a> tags with href and content
        link_pattern = r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>'
        matches = re.findall(link_pattern, html_content, re.IGNORECASE | re.DOTALL)

        # Search by keyword priority
        for keyword in self.LINK_KEYWORDS:
            for href, link_text in matches:
                # Skip non-navigation links
                if href.startswith(("#", "javascript:", "mailto:", "tel:")):
                    continue

                # Skip external links (different domain)
                if href.startswith("http"):
                    parsed_href = urlparse(href)
                    parsed_base = urlparse(base_url)
                    if parsed_href.netloc != parsed_base.netloc:
                        continue

                # Clean link text (remove HTML tags)
                link_text_clean = re.sub(r'<[^>]+>', '', link_text).strip().lower()
                href_lower = href.lower()

                # Check if keyword is in link text OR href
                if keyword in link_text_clean or keyword in href_lower:
                    # Normalize URL
                    if href.startswith("http"):
                        return href
                    elif href.startswith("/"):
                        return urljoin(base_url, href)
                    else:
                        return urljoin(base_url, "/" + href)

        # Fallback: Check href attributes directly for partial matches
        href_pattern = r'href=["\']([^"\']+)["\']'
        href_matches = re.findall(href_pattern, html_content, re.IGNORECASE)

        for keyword in self.LINK_KEYWORDS[:5]:  # Only high-priority keywords
            for href in href_matches:
                if href.startswith(("#", "javascript:", "mailto:", "tel:")):
                    continue

                if keyword in href.lower():
                    if href.startswith("http"):
                        parsed_href = urlparse(href)
                        parsed_base = urlparse(base_url)
                        if parsed_href.netloc == parsed_base.netloc:
                            return href
                    elif href.startswith("/"):
                        return urljoin(base_url, href)
                    elif not href.startswith(("http", "#")):
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
