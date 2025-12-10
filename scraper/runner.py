"""Main scraper runner with async batch processing."""

import asyncio
import time
import uuid
from typing import List, Dict, Optional, Callable, Any
from tqdm.asyncio import tqdm
import logging

from .config import ScraperConfig
from .core.fetcher import Fetcher
from .core.parser import ImpressumParser
from .core.extractor import LLMExtractor
from .models.impressum import ScrapeResult, ScrapeJob, ScrapeStatus, ContactInfo

logger = logging.getLogger(__name__)


class ImpressumScraper:
    """
    High-performance Impressum scraper.

    Orchestrates fetching, parsing, and LLM extraction for bulk URL processing.
    Designed for 10,000+ URLs with parallel processing.
    """

    def __init__(self, config: ScraperConfig):
        """
        Initialize the scraper.

        Args:
            config: Scraper configuration
        """
        self._config = config
        self._fetcher: Optional[Fetcher] = None
        self._parser: Optional[ImpressumParser] = None
        self._extractor: Optional[LLMExtractor] = None

        # Active jobs storage
        self._jobs: Dict[str, ScrapeJob] = {}
        self._cancelled_jobs: set = set()

    async def _ensure_initialized(self) -> None:
        """Ensure all components are initialized."""
        if self._fetcher is None:
            self._fetcher = Fetcher(
                max_concurrent=self._config.http_concurrency,
                timeout=self._config.http_timeout,
                dns_cache_ttl=self._config.dns_cache_ttl,
                verify_ssl=self._config.verify_ssl,
            )

        if self._parser is None:
            self._parser = ImpressumParser()

        if self._extractor is None and self._config.has_api_key:
            self._extractor = LLMExtractor(
                api_key=self._config.openai_api_key,
                model=self._config.model,
                max_concurrent=self._config.llm_concurrency,
                temperature=self._config.llm_temperature,
                max_tokens=self._config.llm_max_tokens,
            )

    async def scrape_url(self, url: str) -> ScrapeResult:
        """
        Scrape a single URL.

        Args:
            url: URL to scrape

        Returns:
            ScrapeResult with extracted data
        """
        await self._ensure_initialized()
        start_time = time.monotonic()

        try:
            # Step 1: Fetch HTML with Impressum discovery
            html_content, impressum_url, pages_checked = await self._fetcher.fetch_with_impressum(url)

            if not html_content:
                return ScrapeResult(
                    url=url,
                    success=False,
                    error="Could not fetch page content",
                    pages_checked=pages_checked,
                    duration_ms=int((time.monotonic() - start_time) * 1000),
                )

            # Step 2: Parse HTML
            parsed = self._parser.parse(html_content)

            # Step 3: LLM extraction (if available)
            contact = None
            extraction_method = "regex"

            if self._extractor:
                text_for_llm = self._parser.get_text_for_llm(
                    html_content,
                    max_length=self._config.max_text_length,
                )

                contact = await self._extractor.extract(
                    text=text_for_llm,
                    fallback_emails=parsed["emails"],
                    fallback_phones=parsed["phones"],
                )
                extraction_method = "llm"

            # Fallback to regex-only extraction
            if not contact and (parsed["emails"] or parsed["phones"]):
                contact = ContactInfo(
                    email=parsed["emails"][0] if parsed["emails"] else None,
                    phone=parsed["phones"][0] if parsed["phones"] else None,
                    address=parsed["address"],
                    confidence=0.3,
                )

                # Try to add name from parsed data
                if parsed["names"]:
                    contact.first_name = parsed["names"][0].get("first_name")
                    contact.last_name = parsed["names"][0].get("last_name")
                    contact.confidence = 0.5

            return ScrapeResult(
                url=url,
                success=contact is not None,
                contact=contact,
                all_emails=parsed["emails"],
                all_phones=parsed["phones"],
                impressum_url=impressum_url,
                pages_checked=pages_checked,
                extraction_method=extraction_method,
                duration_ms=int((time.monotonic() - start_time) * 1000),
            )

        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            return ScrapeResult(
                url=url,
                success=False,
                error=str(e),
                duration_ms=int((time.monotonic() - start_time) * 1000),
            )

    async def scrape_urls(
        self,
        urls: List[str],
        progress_callback: Optional[Callable[[int, int, Optional[ScrapeResult]], Any]] = None,
        job_id: Optional[str] = None,
    ) -> List[ScrapeResult]:
        """
        Scrape multiple URLs with progress tracking.

        Args:
            urls: List of URLs to scrape
            progress_callback: Optional callback(completed, total, result)
            job_id: Optional job ID for cancellation support

        Returns:
            List of ScrapeResult objects
        """
        await self._ensure_initialized()

        results: List[ScrapeResult] = []
        total = len(urls)

        # Create semaphore for controlled concurrency
        semaphore = asyncio.Semaphore(self._config.http_concurrency)

        async def process_url(url: str, index: int) -> ScrapeResult:
            # Check for cancellation
            if job_id and job_id in self._cancelled_jobs:
                return ScrapeResult(
                    url=url,
                    success=False,
                    error="Job cancelled",
                )

            async with semaphore:
                result = await self.scrape_url(url)

                if progress_callback:
                    progress_callback(index + 1, total, result)

                return result

        # Process all URLs with progress bar
        tasks = [process_url(url, i) for i, url in enumerate(urls)]

        # Use tqdm for progress tracking
        with tqdm(total=total, desc="Scraping", unit="url") as pbar:
            for coro in asyncio.as_completed(tasks):
                result = await coro
                results.append(result)
                pbar.update(1)

        return results

    def create_job(self, urls: List[str]) -> ScrapeJob:
        """
        Create a new scraping job.

        Args:
            urls: List of URLs to scrape

        Returns:
            ScrapeJob object with job ID
        """
        job_id = str(uuid.uuid4())

        job = ScrapeJob(
            job_id=job_id,
            status=ScrapeStatus.PENDING,
            total=len(urls),
            max_concurrent=self._config.http_concurrency,
        )

        self._jobs[job_id] = job
        return job

    async def run_job(
        self,
        job_id: str,
        urls: List[str],
        progress_callback: Optional[Callable[[ScrapeJob], Any]] = None,
    ) -> ScrapeJob:
        """
        Run a scraping job.

        Args:
            job_id: Job ID from create_job
            urls: List of URLs
            progress_callback: Optional callback for progress updates

        Returns:
            Completed ScrapeJob
        """
        job = self._jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.status = ScrapeStatus.RUNNING

        def update_progress(completed: int, total: int, result: Optional[ScrapeResult]):
            job.completed = completed
            if result:
                job.results.append(result)
                if not result.success:
                    job.failed += 1

            if progress_callback:
                progress_callback(job)

        try:
            await self.scrape_urls(
                urls=urls,
                progress_callback=update_progress,
                job_id=job_id,
            )

            if job_id in self._cancelled_jobs:
                job.status = ScrapeStatus.CANCELLED
                self._cancelled_jobs.discard(job_id)
            else:
                job.status = ScrapeStatus.COMPLETED

        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            job.status = ScrapeStatus.FAILED

        return job

    def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a running job.

        Args:
            job_id: Job ID to cancel

        Returns:
            True if cancellation was requested
        """
        if job_id in self._jobs:
            self._cancelled_jobs.add(job_id)
            return True
        return False

    def get_job(self, job_id: str) -> Optional[ScrapeJob]:
        """Get job by ID."""
        return self._jobs.get(job_id)

    async def close(self) -> None:
        """Clean up resources."""
        if self._fetcher:
            await self._fetcher.close()
        if self._extractor:
            await self._extractor.close()

    async def __aenter__(self):
        """Async context manager entry."""
        await self._ensure_initialized()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
