# -*- coding: utf-8 -*-
"""Main scraper runner with async batch processing.

This module provides the core scraping orchestration, coordinating
fetching, parsing, and LLM extraction for bulk URL processing.
"""

import asyncio
import time
import uuid
from typing import List, Dict, Optional, Callable, Any, TYPE_CHECKING
from urllib.parse import urlparse
from tqdm.asyncio import tqdm
import structlog

from .config import ScraperConfig
from .core.fetcher import Fetcher
from .core.parser import ImpressumParser
from .core.extractor import LLMExtractor
from .models.impressum import ScrapeResult, ScrapeJob, ScrapeStatus, ContactInfo

if TYPE_CHECKING:
    from .core.job_store import JobStore

logger = structlog.get_logger(__name__)


class ImpressumScraper:
    """
    High-performance Impressum scraper.

    Orchestrates fetching, parsing, and LLM extraction for bulk URL processing.
    Designed for 10,000+ URLs with parallel processing.

    Features:
    - Async batch processing with configurable concurrency
    - Multi-provider LLM support (OpenAI, Anthropic, Ollama)
    - Progress tracking and cancellation support
    - Integration with centralized JobStore

    Example:
        async with ImpressumScraper(config) as scraper:
            result = await scraper.scrape_url("https://example.de")
            results = await scraper.scrape_urls(["https://a.de", "https://b.de"])
    """

    def __init__(self, config: ScraperConfig, enable_domain_cache: bool = True):
        """
        Initialize the scraper.

        Args:
            config: Scraper configuration
            enable_domain_cache: Cache results per domain to avoid duplicate scraping
        """
        self._config = config
        self._fetcher: Optional[Fetcher] = None
        self._parser: Optional[ImpressumParser] = None
        self._extractor: Optional[LLMExtractor] = None

        # Legacy job storage (for backwards compatibility)
        self._jobs: Dict[str, ScrapeJob] = {}
        self._cancelled_jobs: set = set()

        # Domain-level result cache for efficiency
        self._enable_domain_cache = enable_domain_cache
        self._domain_results: Dict[str, ScrapeResult] = {}

        self._log = logger.bind(
            llm_provider=config.llm_provider,
            http_concurrency=config.http_concurrency,
        )

    async def _ensure_initialized(self) -> None:
        """Ensure all components are initialized."""
        if self._fetcher is None:
            self._fetcher = Fetcher(
                max_concurrent=self._config.http_concurrency,
                timeout=self._config.http_timeout,
                dns_cache_ttl=self._config.dns_cache_ttl,
                verify_ssl=self._config.verify_ssl,
                ssl_ca_bundle=self._config.ssl_ca_bundle,
                respect_robots=self._config.respect_robots,
                enable_cache=self._config.enable_cache,
            )

        if self._parser is None:
            self._parser = ImpressumParser()

        if self._extractor is None and self._config.has_api_key:
            self._extractor = LLMExtractor.create(self._config)

    async def scrape_url(self, url: str) -> ScrapeResult:
        """
        Scrape a single URL.

        Uses multi-stage extraction strategy:
        0. Check domain cache for existing result
        1. Fetch Impressum/Contact page
        2. Parse for emails/phones/names
        3. If incomplete: scan footer as fallback
        4. If Impressum found on subpage: also scan main page
        5. LLM extraction with all collected data

        Args:
            url: URL to scrape

        Returns:
            ScrapeResult with extracted data
        """
        await self._ensure_initialized()
        start_time = time.monotonic()

        log = self._log.bind(url=url)

        # Step 0: Check domain cache for existing result
        if self._enable_domain_cache:
            parsed = urlparse(url)
            domain = parsed.netloc

            if domain in self._domain_results:
                cached = self._domain_results[domain]
                log.debug("domain_cache_hit", domain=domain)
                # Return copy with new URL
                return ScrapeResult(
                    url=url,
                    success=cached.success,
                    contact=cached.contact,
                    all_emails=cached.all_emails,
                    all_phones=cached.all_phones,
                    impressum_url=cached.impressum_url,
                    pages_checked=cached.pages_checked,
                    extraction_method="cached",
                    duration_ms=0,
                )

        try:
            # Step 1: Fetch HTML with Impressum discovery
            html_content, impressum_url, pages_checked = await self._fetcher.fetch_with_impressum(url)

            if not html_content:
                log.debug("fetch_failed", error="Could not fetch page content")
                return ScrapeResult(
                    url=url,
                    success=False,
                    error="Could not fetch page content",
                    pages_checked=pages_checked,
                    duration_ms=int((time.monotonic() - start_time) * 1000),
                )

            # Step 2: Parse HTML
            parsed = self._parser.parse(html_content)

            # Step 3: Footer fallback if data is incomplete
            if len(parsed["emails"]) == 0 or len(parsed["phones"]) == 0:
                footer_data = self._parser._strategy.extract_footer_contacts(html_content)

                # Merge footer emails (only if we don't have any)
                if len(parsed["emails"]) == 0 and footer_data["emails"]:
                    parsed["emails"] = footer_data["emails"]
                    log.debug("footer_fallback", field="emails", count=len(footer_data["emails"]))

                # Merge footer phones (only if we don't have any)
                if len(parsed["phones"]) == 0 and footer_data["phones"]:
                    parsed["phones"] = footer_data["phones"]
                    log.debug("footer_fallback", field="phones", count=len(footer_data["phones"]))

            # Step 4: Main page scan if Impressum was on a subpage
            if impressum_url and impressum_url != url:
                # We found Impressum on a different page - also scan main page for additional contacts
                try:
                    main_content, main_status = await self._fetcher.fetch(url)
                    if main_status == 200 and main_content:
                        main_parsed = self._parser.parse(main_content)

                        # Merge emails from main page (append, don't override)
                        for email in main_parsed["emails"]:
                            if email not in parsed["emails"]:
                                parsed["emails"].append(email)

                        # Merge phones from main page (append, don't override)
                        for phone in main_parsed["phones"]:
                            if phone not in parsed["phones"]:
                                parsed["phones"].append(phone)

                        # Merge names if we don't have any
                        if not parsed["names"] and main_parsed["names"]:
                            parsed["names"] = main_parsed["names"]

                        log.debug("main_page_scanned", new_emails=len(main_parsed["emails"]))
                except Exception as e:
                    log.debug("main_page_scan_failed", error=str(e))

            # Step 5: LLM extraction (if available)
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

            # Fallback to regex-only extraction (email/phone only - NO names without LLM)
            if not contact and (parsed["emails"] or parsed["phones"]):
                contact = ContactInfo(
                    email=parsed["emails"][0] if parsed["emails"] else None,
                    phone=parsed["phones"][0] if parsed["phones"] else None,
                    address=parsed["address"],
                    confidence=0.3,
                )
                # NOTE: Regex-based name extraction disabled - produces garbage without LLM
                # Names are only extracted when LLM (OpenAI API key) is configured

            duration_ms = int((time.monotonic() - start_time) * 1000)

            log.info(
                "url_scraped",
                success=contact is not None,
                extraction_method=extraction_method,
                duration_ms=duration_ms,
                emails_found=len(parsed["emails"]),
                phones_found=len(parsed["phones"]),
            )

            result = ScrapeResult(
                url=url,
                success=contact is not None,
                contact=contact,
                all_emails=parsed["emails"],
                all_phones=parsed["phones"],
                impressum_url=impressum_url,
                pages_checked=pages_checked,
                extraction_method=extraction_method,
                duration_ms=duration_ms,
            )

            # Cache successful results by domain
            if self._enable_domain_cache and result.success:
                parsed_url = urlparse(url)
                self._domain_results[parsed_url.netloc] = result

            return result

        except Exception as e:
            log.error("scrape_error", error=str(e))
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

    async def run_job_with_store(
        self,
        job_id: str,
        urls: List[str],
        job_store: "JobStore",
    ) -> None:
        """
        Run a scraping job using the centralized JobStore.

        This method is the preferred way to run jobs in production,
        ensuring proper state management across instances.

        Args:
            job_id: Job ID from JobStore.create()
            urls: List of URLs to scrape
            job_store: JobStore instance for state management
        """
        await self._ensure_initialized()

        log = self._log.bind(job_id=job_id, total_urls=len(urls))
        log.info("job_started")

        # Create semaphore for controlled concurrency
        semaphore = asyncio.Semaphore(self._config.http_concurrency)
        completed_count = 0

        async def process_url(url: str) -> ScrapeResult:
            nonlocal completed_count

            # Check for cancellation
            if job_store.is_cancelled(job_id):
                return ScrapeResult(
                    url=url,
                    success=False,
                    error="Job cancelled",
                )

            async with semaphore:
                result = await self.scrape_url(url)
                completed_count += 1

                # Update JobStore with result
                await job_store.update(job_id, add_result=result)

                return result

        try:
            # Process all URLs
            tasks = [process_url(url) for url in urls]

            # Use tqdm for progress tracking
            with tqdm(total=len(urls), desc=f"Job {job_id[:8]}", unit="url") as pbar:
                for coro in asyncio.as_completed(tasks):
                    await coro
                    pbar.update(1)

                    # Check for cancellation
                    if job_store.is_cancelled(job_id):
                        log.info("job_cancelled", completed=completed_count)
                        break

            # Update final status
            if job_store.is_cancelled(job_id):
                await job_store.update(job_id, status=ScrapeStatus.CANCELLED)
            else:
                await job_store.update(job_id, status=ScrapeStatus.COMPLETED)

            # Emit completion event
            job = await job_store.get(job_id)
            if job:
                await job_store._emit_event(job_id, {
                    "type": "completed" if job.status == ScrapeStatus.COMPLETED else "cancelled",
                })

            log.info("job_completed", status=job.status.value if job else "unknown")

        except Exception as e:
            log.error("job_failed", error=str(e))
            await job_store.update(job_id, status=ScrapeStatus.FAILED)
            await job_store._emit_event(job_id, {"type": "failed"})
            raise

    def create_job(self, urls: List[str]) -> ScrapeJob:
        """
        Create a new scraping job (legacy method).

        For new code, use JobStore.create() instead.

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
        Run a scraping job (legacy method).

        For new code, use run_job_with_store() instead.

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
            self._log.error("job_failed", job_id=job_id, error=str(e))
            job.status = ScrapeStatus.FAILED

        return job

    def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a running job (legacy method).

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
        """Get job by ID (legacy method)."""
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
