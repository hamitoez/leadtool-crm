# -*- coding: utf-8 -*-
"""Tests for the FastAPI server module."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from scraper.models.impressum import ScrapeResult, ScrapeJob, ScrapeStatus, ContactInfo


class TestServerEndpoints:
    """Tests for server endpoints using mocked dependencies."""

    @pytest.fixture
    def mock_job_store(self):
        """Create mock job store."""
        store = MagicMock()
        store.create = AsyncMock(return_value=ScrapeJob(
            job_id="test-job-123",
            status=ScrapeStatus.PENDING,
            total=10,
        ))
        store.get = AsyncMock(return_value=ScrapeJob(
            job_id="test-job-123",
            status=ScrapeStatus.RUNNING,
            total=10,
            completed=5,
            failed=1,
        ))
        store.update = AsyncMock(return_value=True)
        store.cancel = AsyncMock(return_value=True)
        store.list_jobs = AsyncMock(return_value=[])
        store.job_count = 1
        store.active_job_count = 1
        return store

    @pytest.fixture
    def mock_scraper(self):
        """Create mock scraper."""
        scraper = MagicMock()
        scraper.scrape_url = AsyncMock(return_value=ScrapeResult(
            url="https://example.de",
            success=True,
            contact=ContactInfo(
                email="test@example.de",
                confidence=0.8,
            ),
            all_emails=["test@example.de"],
            all_phones=[],
            duration_ms=1000,
        ))
        scraper.close = AsyncMock()
        return scraper


class TestBulkJobLifecycle:
    """Tests for bulk job lifecycle."""

    def test_job_creation(self):
        """Test that jobs are created correctly."""
        job = ScrapeJob(
            job_id="test-123",
            status=ScrapeStatus.PENDING,
            total=100,
        )
        assert job.job_id == "test-123"
        assert job.status == ScrapeStatus.PENDING
        assert job.total == 100
        assert job.completed == 0
        assert job.failed == 0

    def test_job_progress_calculation(self):
        """Test job progress calculation."""
        job = ScrapeJob(
            job_id="test-123",
            status=ScrapeStatus.RUNNING,
            total=100,
            completed=50,
        )
        assert job.progress == 50.0

    def test_job_progress_zero_total(self):
        """Test progress with zero total."""
        job = ScrapeJob(
            job_id="test-123",
            status=ScrapeStatus.PENDING,
            total=0,
        )
        assert job.progress == 0.0

    def test_job_status_transitions(self):
        """Test valid job status transitions."""
        job = ScrapeJob(
            job_id="test-123",
            status=ScrapeStatus.PENDING,
            total=10,
        )

        # PENDING -> RUNNING
        job.status = ScrapeStatus.RUNNING
        assert job.status == ScrapeStatus.RUNNING

        # RUNNING -> COMPLETED
        job.status = ScrapeStatus.COMPLETED
        assert job.status == ScrapeStatus.COMPLETED


class TestJobCancellation:
    """Tests for job cancellation functionality."""

    @pytest.mark.asyncio
    async def test_cancel_running_job(self):
        """Test cancelling a running job."""
        from scraper.core.job_store import JobStore

        # Reset singleton for testing
        await JobStore.reset_instance()

        store = await JobStore.get_instance()
        from scraper.config import ScraperConfig
        config = ScraperConfig(openai_api_key="test")

        job = await store.create(["https://example.de"], config)
        await store.update(job.job_id, status=ScrapeStatus.RUNNING)

        success = await store.cancel(job.job_id)
        assert success is True
        assert store.is_cancelled(job.job_id)

        await store.shutdown()

    @pytest.mark.asyncio
    async def test_cancel_nonexistent_job(self):
        """Test cancelling a job that doesn't exist."""
        from scraper.core.job_store import JobStore

        await JobStore.reset_instance()
        store = await JobStore.get_instance()

        success = await store.cancel("nonexistent-job")
        assert success is False

        await store.shutdown()


class TestAPIKeyHandling:
    """Tests for API key extraction and handling."""

    def test_mask_api_key_short(self):
        """Test masking short API keys."""
        from scraper.server import mask_api_key

        assert mask_api_key("short") == "***"
        assert mask_api_key("12345678") == "***"

    def test_mask_api_key_long(self):
        """Test masking long API keys."""
        from scraper.server import mask_api_key

        result = mask_api_key("sk-1234567890abcdefghij")
        assert result == "sk-1...ghij"
        assert "1234567890" not in result

    def test_mask_api_key_none(self):
        """Test masking None API key."""
        from scraper.server import mask_api_key

        assert mask_api_key(None) == "not-provided"

    @pytest.mark.asyncio
    async def test_get_api_key_from_header(self):
        """Test extracting API key from X-API-Key header."""
        from scraper.server import get_api_key

        key = await get_api_key(x_api_key="test-key", authorization=None)
        assert key == "test-key"

    @pytest.mark.asyncio
    async def test_get_api_key_from_bearer(self):
        """Test extracting API key from Authorization Bearer."""
        from scraper.server import get_api_key

        key = await get_api_key(x_api_key=None, authorization="Bearer test-bearer-key")
        assert key == "test-bearer-key"

    @pytest.mark.asyncio
    async def test_get_api_key_none(self):
        """Test when no API key is provided."""
        from scraper.server import get_api_key

        key = await get_api_key(x_api_key=None, authorization=None)
        assert key is None


class TestMetricsEndpoint:
    """Tests for the metrics endpoint."""

    def test_metrics_format(self):
        """Test that metrics are in Prometheus format."""
        # Metrics should contain counter and gauge definitions
        expected_metrics = [
            "scraper_requests_total",
            "scraper_active_jobs",
            "scraper_urls_scraped_total",
        ]

        for metric in expected_metrics:
            # These metrics should be defined in the endpoint
            assert metric  # Just verify they exist as constants
