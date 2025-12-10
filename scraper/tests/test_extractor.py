# -*- coding: utf-8 -*-
"""Tests for the LLM extractor module."""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch

from scraper.core.extractor import (
    LLMExtractor,
    LLMProvider,
    OpenAIProvider,
    AnthropicProvider,
    OllamaProvider,
)
from scraper.models.impressum import ContactInfo
from scraper.config import ScraperConfig


class TestLLMExtractor:
    """Tests for the LLMExtractor class."""

    @pytest.fixture
    def mock_provider(self):
        """Create a mock LLM provider."""
        provider = MagicMock(spec=LLMProvider)
        provider.provider_name = "mock"
        provider.extract = AsyncMock(return_value={
            "first_name": "Max",
            "last_name": "Mustermann",
            "email": "max@example.de",
            "phone": "+4912345678",
            "confidence": 0.9,
        })
        provider.close = AsyncMock()
        return provider

    @pytest.fixture
    def extractor(self, mock_provider):
        """Create extractor with mock provider."""
        return LLMExtractor(mock_provider)

    @pytest.mark.asyncio
    async def test_extract_success(self, extractor, mock_provider):
        """Test successful extraction."""
        text = "Geschäftsführer: Max Mustermann, E-Mail: max@example.de"
        result = await extractor.extract(text)

        assert result is not None
        assert result.first_name == "Max"
        assert result.last_name == "Mustermann"
        assert result.email == "max@example.de"
        assert result.confidence == 0.9

    @pytest.mark.asyncio
    async def test_extract_with_fallback_emails(self, extractor, mock_provider):
        """Test extraction with fallback emails."""
        mock_provider.extract = AsyncMock(return_value={
            "first_name": "Max",
            "last_name": "Mustermann",
            "confidence": 0.8,
        })

        text = "Geschäftsführer: Max Mustermann"
        fallback_emails = ["fallback@example.de"]

        result = await extractor.extract(text, fallback_emails=fallback_emails)

        assert result is not None
        assert result.email == "fallback@example.de"
        assert result.confidence < 0.8  # Reduced due to fallback

    @pytest.mark.asyncio
    async def test_extract_with_fallback_phones(self, extractor, mock_provider):
        """Test extraction with fallback phones."""
        mock_provider.extract = AsyncMock(return_value={
            "first_name": "Max",
            "email": "max@example.de",
        })

        text = "Max, max@example.de"
        fallback_phones = ["+4912345678"]

        result = await extractor.extract(text, fallback_phones=fallback_phones)

        assert result is not None
        assert result.phone == "+4912345678"

    @pytest.mark.asyncio
    async def test_extract_llm_failure(self, extractor, mock_provider):
        """Test fallback on LLM failure."""
        mock_provider.extract = AsyncMock(return_value=None)

        text = "Some text"
        fallback_emails = ["fallback@example.de"]

        result = await extractor.extract(text, fallback_emails=fallback_emails)

        assert result is not None
        assert result.email == "fallback@example.de"
        assert result.confidence == 0.3  # Low confidence for fallback

    @pytest.mark.asyncio
    async def test_extract_short_text(self, extractor, mock_provider):
        """Test handling of very short text."""
        result = await extractor.extract("Hi", fallback_emails=["a@b.de"])

        # Should use fallback for short text
        assert result is not None

    @pytest.mark.asyncio
    async def test_extract_batch(self, extractor, mock_provider):
        """Test batch extraction."""
        texts = [
            {"text": "Text 1", "fallback_emails": ["a@example.de"]},
            {"text": "Text 2", "fallback_emails": ["b@example.de"]},
        ]

        results = await extractor.extract_batch(texts)

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_stats_tracking(self, extractor, mock_provider):
        """Test that extraction stats are tracked."""
        # Provide text long enough to not be skipped
        long_text = "Test text here " * 20  # > 50 chars
        await extractor.extract(long_text)

        stats = extractor.stats
        assert stats["total_calls"] == 1
        assert stats["successful_calls"] == 1
        assert stats["failed_calls"] == 0

    @pytest.mark.asyncio
    async def test_close(self, extractor, mock_provider):
        """Test provider cleanup."""
        await extractor.close()
        mock_provider.close.assert_called_once()


class TestLLMExtractorFactory:
    """Tests for LLMExtractor.create() factory method."""

    def test_create_openai_provider(self):
        """Test creating OpenAI provider from config."""
        config = ScraperConfig(
            llm_provider="openai",
            openai_api_key="test-key",
            model="gpt-4o",
        )

        # This will fail without mocking OpenAI, so we just test the logic
        with patch('scraper.core.extractor.OpenAIProvider') as mock:
            mock.return_value = MagicMock()
            extractor = LLMExtractor.create(config)
            mock.assert_called_once()

    def test_create_anthropic_provider(self):
        """Test creating Anthropic provider from config."""
        config = ScraperConfig(
            llm_provider="anthropic",
            anthropic_api_key="test-key",
            model="claude-sonnet-4-20250514",
        )

        with patch('scraper.core.extractor.AnthropicProvider') as mock:
            mock.return_value = MagicMock()
            extractor = LLMExtractor.create(config)
            mock.assert_called_once()

    def test_create_ollama_provider(self):
        """Test creating Ollama provider from config."""
        config = ScraperConfig(
            llm_provider="ollama",
            ollama_base_url="http://localhost:11434",
            model="llama3.2",
        )

        with patch('scraper.core.extractor.OllamaProvider') as mock:
            mock.return_value = MagicMock()
            extractor = LLMExtractor.create(config)
            mock.assert_called_once()


class TestConfidenceScoring:
    """Tests for confidence score handling."""

    @pytest.fixture
    def mock_provider(self):
        provider = MagicMock(spec=LLMProvider)
        provider.provider_name = "mock"
        provider.close = AsyncMock()
        return provider

    @pytest.mark.asyncio
    async def test_high_confidence_llm_result(self, mock_provider):
        """Test high confidence from LLM."""
        mock_provider.extract = AsyncMock(return_value={
            "first_name": "Max",
            "last_name": "Mustermann",
            "email": "max@example.de",
            "confidence": 0.95,
        })

        extractor = LLMExtractor(mock_provider)
        # Provide text long enough to not be skipped (> 50 chars)
        long_text = "Full impressum text with enough content to pass validation " * 2
        result = await extractor.extract(long_text)

        assert result.confidence == 0.95

    @pytest.mark.asyncio
    async def test_reduced_confidence_with_fallback(self, mock_provider):
        """Test confidence reduction when using fallbacks."""
        mock_provider.extract = AsyncMock(return_value={
            "first_name": "Max",
            "confidence": 0.8,
        })

        extractor = LLMExtractor(mock_provider)
        # Provide text long enough to not be skipped (> 50 chars)
        long_text = "Text without email but enough content to pass validation " * 2
        result = await extractor.extract(
            long_text,
            fallback_emails=["fallback@example.de"]
        )

        # Confidence should be reduced due to fallback
        assert abs(result.confidence - 0.7) < 0.01  # 0.8 - 0.1, with float tolerance

    @pytest.mark.asyncio
    async def test_low_confidence_fallback_only(self, mock_provider):
        """Test low confidence for fallback-only results."""
        mock_provider.extract = AsyncMock(return_value=None)

        extractor = LLMExtractor(mock_provider)
        result = await extractor.extract(
            "Empty result",
            fallback_emails=["test@example.de"]
        )

        assert result.confidence == 0.3
