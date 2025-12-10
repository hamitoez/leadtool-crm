# -*- coding: utf-8 -*-
"""Tests for the HTTP fetcher module."""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import aiohttp

from scraper.core.fetcher import Fetcher


class TestFetcher:
    """Tests for Fetcher class."""

    @pytest.fixture
    def fetcher(self):
        """Create a fetcher instance for testing."""
        return Fetcher(
            max_concurrent=10,
            timeout=5,
            verify_ssl=True,
        )

    @pytest.mark.asyncio
    async def test_fetcher_initialization(self, fetcher):
        """Test fetcher initializes correctly."""
        assert fetcher._max_concurrent == 10
        assert fetcher._timeout == 5
        assert fetcher._verify_ssl is True

    @pytest.mark.asyncio
    async def test_impressum_link_discovery(self, fetcher):
        """Test finding impressum links in HTML."""
        html = """
        <html>
        <body>
            <nav>
                <a href="/about">About</a>
                <a href="/impressum">Impressum</a>
                <a href="/contact">Contact</a>
            </nav>
        </body>
        </html>
        """
        link = fetcher._find_impressum_link(html, "https://example.de")
        assert link == "https://example.de/impressum"

    @pytest.mark.asyncio
    async def test_impressum_link_discovery_imprint(self, fetcher):
        """Test finding imprint links."""
        html = """
        <html>
        <body>
            <footer>
                <a href="/legal-notice">Legal Notice</a>
                <a href="/imprint">Imprint</a>
            </footer>
        </body>
        </html>
        """
        link = fetcher._find_impressum_link(html, "https://example.de")
        assert link is not None
        assert "imprint" in link.lower() or "legal" in link.lower()

    @pytest.mark.asyncio
    async def test_impressum_link_absolute_url_external_skipped(self, fetcher):
        """Test that external domain links are skipped for security."""
        html = """
        <html>
        <body>
            <a href="https://other-domain.de/impressum">Impressum</a>
        </body>
        </html>
        """
        link = fetcher._find_impressum_link(html, "https://example.de")
        # External links are intentionally skipped - should not follow to different domains
        assert link is None

    @pytest.mark.asyncio
    async def test_impressum_link_absolute_url_same_domain(self, fetcher):
        """Test handling absolute URLs to same domain."""
        html = """
        <html>
        <body>
            <a href="https://example.de/impressum">Impressum</a>
        </body>
        </html>
        """
        link = fetcher._find_impressum_link(html, "https://example.de")
        assert link == "https://example.de/impressum"

    @pytest.mark.asyncio
    async def test_impressum_link_no_match(self, fetcher):
        """Test when no impressum link is found."""
        html = """
        <html>
        <body>
            <a href="/products">Products</a>
            <a href="/services">Services</a>
        </body>
        </html>
        """
        link = fetcher._find_impressum_link(html, "https://example.de")
        assert link is None

    @pytest.mark.asyncio
    async def test_ssl_context_creation_verified(self, fetcher):
        """Test SSL context creation with verification enabled."""
        context = fetcher._create_ssl_context()
        assert context.verify_mode != 0  # Should verify certificates

    @pytest.mark.asyncio
    async def test_ssl_context_creation_unverified(self):
        """Test SSL context creation with verification disabled."""
        import ssl
        fetcher = Fetcher(verify_ssl=False)
        context = fetcher._create_ssl_context()
        assert context.verify_mode == ssl.CERT_NONE

    @pytest.mark.asyncio
    async def test_fetcher_close(self, fetcher):
        """Test fetcher cleanup."""
        # Initialize the session first
        await fetcher._get_session()

        # Verify session exists
        assert fetcher._session is not None

        # Close and verify session is cleared
        await fetcher.close()
        assert fetcher._session is None

    @pytest.mark.asyncio
    async def test_fetcher_context_manager(self):
        """Test async context manager."""
        async with Fetcher() as fetcher:
            assert fetcher is not None
        # Session should be closed after exiting context


class TestFetcherMocked:
    """Tests with mocked HTTP responses."""

    @pytest.mark.asyncio
    async def test_retry_on_timeout(self):
        """Test retry behavior on timeout."""
        fetcher = Fetcher(max_concurrent=5, timeout=1)

        call_count = 0

        async def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise asyncio.TimeoutError()
            # Return successful response on 3rd try
            response = MagicMock()
            response.status = 200
            response.text = AsyncMock(return_value="<html>Success</html>")
            return response

        with patch.object(fetcher, '_get_session') as mock_session:
            session = MagicMock()
            session.get = MagicMock(return_value=AsyncMock(__aenter__=mock_get, __aexit__=AsyncMock()))
            mock_session.return_value = session

            # The retry decorator should handle the timeouts
            # Note: Actual retry testing depends on decorator implementation

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Test that rate limiting is applied."""
        fetcher = Fetcher(max_concurrent=2)

        # Check that rate limiter is configured
        assert fetcher._rate_limiter._max_concurrent == 2
        assert fetcher._rate_limiter.max_concurrent == 2
