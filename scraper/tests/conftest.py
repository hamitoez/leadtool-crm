# -*- coding: utf-8 -*-
"""Pytest configuration and fixtures."""

import asyncio
import pytest
from typing import AsyncGenerator

from scraper.config import ScraperConfig
from scraper.models.impressum import ScrapeResult, ContactInfo, ScrapeJob, ScrapeStatus


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def config() -> ScraperConfig:
    """Create test configuration."""
    return ScraperConfig(
        openai_api_key="test-key",
        model="gpt-4o",
        http_concurrency=10,
        llm_concurrency=5,
        verify_ssl=True,
    )


@pytest.fixture
def sample_result() -> ScrapeResult:
    """Create sample scrape result."""
    return ScrapeResult(
        url="https://example.de",
        success=True,
        contact=ContactInfo(
            first_name="Max",
            last_name="Mustermann",
            email="max.mustermann@example.de",
            phone="+4912345678901",
            position="Geschäftsführer",
            company="Example GmbH",
            address="Musterstraße 123, 12345 Berlin",
            confidence=0.9,
        ),
        all_emails=["max.mustermann@example.de", "info@example.de"],
        all_phones=["+4912345678901"],
        impressum_url="https://example.de/impressum",
        pages_checked=["https://example.de", "https://example.de/impressum"],
        extraction_method="llm",
        duration_ms=1234,
    )


@pytest.fixture
def sample_html() -> str:
    """Sample German Impressum HTML."""
    return """
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <title>Impressum - Example GmbH</title>
    </head>
    <body>
        <h1>Impressum</h1>
        <p>Angaben gemäß § 5 TMG:</p>

        <h2>Example GmbH</h2>
        <p>Musterstraße 123<br>
        12345 Berlin</p>

        <h3>Vertreten durch:</h3>
        <p>Geschäftsführer: Max Mustermann</p>

        <h3>Kontakt:</h3>
        <p>Telefon: +49 123 456789-0<br>
        E-Mail: max.mustermann@example.de</p>

        <h3>Registereintrag:</h3>
        <p>Eintragung im Handelsregister<br>
        Registergericht: Amtsgericht Berlin<br>
        Registernummer: HRB 123456</p>
    </body>
    </html>
    """


@pytest.fixture
def malformed_html() -> str:
    """Sample malformed HTML."""
    return """
    <html>
    <body>
        <div class="impressum"
            <p>Incomplete tag
            <a href="/kontakt">Contact</a>
        </div>
        <script>
            var email = "info" + "@" + "example.de";
        </script>
    </body>
    """


@pytest.fixture
def obfuscated_email_html() -> str:
    """HTML with obfuscated emails."""
    return """
    <html>
    <body>
        <p>Email: max (at) example (dot) de</p>
        <p>Kontakt: info [at] example [dot] de</p>
        <p>Support: support (ät) example (punkt) de</p>
    </body>
    </html>
    """
