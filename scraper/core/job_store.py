# -*- coding: utf-8 -*-
"""Centralized job storage for cross-instance job management.

This module provides a thread-safe, singleton JobStore that ensures
jobs are accessible across all scraper instances, fixing the race
condition in bulk job handling.
"""

import asyncio
import time
import uuid
from collections import OrderedDict
from typing import Optional, List, Dict, Any, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
import logging

from ..models.impressum import ScrapeJob, ScrapeResult, ScrapeStatus
from ..config import ScraperConfig

logger = logging.getLogger(__name__)


@dataclass
class StoredJob:
    """Extended job metadata for storage management."""

    job: ScrapeJob
    config: ScraperConfig
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    last_accessed: float = field(default_factory=time.time)

    def touch(self) -> None:
        """Update last accessed time."""
        self.last_accessed = time.time()

    def mark_completed(self) -> None:
        """Mark job as completed with timestamp."""
        self.completed_at = time.time()

    @property
    def age_seconds(self) -> float:
        """Time since job creation in seconds."""
        return time.time() - self.created_at

    @property
    def completion_age_seconds(self) -> Optional[float]:
        """Time since job completion in seconds."""
        if self.completed_at is None:
            return None
        return time.time() - self.completed_at


class JobStore:
    """
    Centralized job storage with TTL-based cleanup and LRU eviction.

    This singleton class manages all scraping jobs across scraper instances,
    ensuring consistent job state and preventing race conditions.

    Features:
    - Thread-safe operations with asyncio locks
    - TTL-based automatic cleanup of completed jobs
    - LRU eviction when max jobs limit is reached
    - Event-based result streaming support
    - Prepared for Redis backend extension

    Example:
        store = JobStore.get_instance()
        job = await store.create(urls, config)
        job = await store.get(job_id)
        await store.update(job_id, status=ScrapeStatus.RUNNING)
    """

    _instance: Optional["JobStore"] = None
    _lock: asyncio.Lock = asyncio.Lock()

    def __init__(
        self,
        job_retention_seconds: int = 3600,
        max_stored_jobs: int = 1000,
        cleanup_interval_seconds: int = 300,
    ):
        """
        Initialize JobStore.

        Args:
            job_retention_seconds: TTL for completed jobs (default: 1 hour)
            max_stored_jobs: Maximum number of stored jobs (LRU eviction)
            cleanup_interval_seconds: Interval for cleanup task
        """
        self._jobs: OrderedDict[str, StoredJob] = OrderedDict()
        self._job_retention_seconds = job_retention_seconds
        self._max_stored_jobs = max_stored_jobs
        self._cleanup_interval = cleanup_interval_seconds
        self._write_lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None

        # Event streams for SSE support
        self._job_events: Dict[str, asyncio.Queue] = {}

        # Cancellation support
        self._cancelled_jobs: set = set()

    @classmethod
    async def get_instance(cls) -> "JobStore":
        """
        Get or create singleton instance.

        Returns:
            JobStore singleton instance
        """
        async with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
                cls._instance._start_cleanup_task()
                logger.info("JobStore instance created")
            return cls._instance

    @classmethod
    async def reset_instance(cls) -> None:
        """Reset singleton instance (for testing)."""
        async with cls._lock:
            if cls._instance is not None:
                await cls._instance.shutdown()
                cls._instance = None

    def _start_cleanup_task(self) -> None:
        """Start background cleanup task."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.debug("Cleanup task started")

    async def _cleanup_loop(self) -> None:
        """Periodic cleanup of expired jobs."""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                cleaned = await self.cleanup_expired()
                if cleaned > 0:
                    logger.info(f"Cleaned up {cleaned} expired jobs")
            except asyncio.CancelledError:
                logger.debug("Cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

    async def create(
        self,
        urls: List[str],
        config: ScraperConfig,
        job_id: Optional[str] = None,
    ) -> ScrapeJob:
        """
        Create a new scraping job.

        Args:
            urls: List of URLs to scrape
            config: Scraper configuration
            job_id: Optional custom job ID

        Returns:
            Created ScrapeJob instance
        """
        async with self._write_lock:
            # Generate job ID if not provided
            if job_id is None:
                job_id = str(uuid.uuid4())

            # Create job instance
            job = ScrapeJob(
                job_id=job_id,
                status=ScrapeStatus.PENDING,
                total=len(urls),
                max_concurrent=config.http_concurrency,
            )

            # Store with metadata
            stored = StoredJob(job=job, config=config)

            # Check max jobs limit and evict LRU if needed
            while len(self._jobs) >= self._max_stored_jobs:
                await self._evict_lru()

            self._jobs[job_id] = stored

            # Create event queue for this job
            self._job_events[job_id] = asyncio.Queue()

            logger.info(f"Created job {job_id} with {len(urls)} URLs")
            return job

    async def get(self, job_id: str) -> Optional[ScrapeJob]:
        """
        Get job by ID.

        Args:
            job_id: Job identifier

        Returns:
            ScrapeJob or None if not found
        """
        stored = self._jobs.get(job_id)
        if stored:
            stored.touch()
            # Move to end of OrderedDict (LRU update)
            self._jobs.move_to_end(job_id)
            return stored.job
        return None

    async def get_config(self, job_id: str) -> Optional[ScraperConfig]:
        """
        Get config for a job.

        Args:
            job_id: Job identifier

        Returns:
            ScraperConfig or None if not found
        """
        stored = self._jobs.get(job_id)
        return stored.config if stored else None

    async def update(
        self,
        job_id: str,
        status: Optional[ScrapeStatus] = None,
        completed: Optional[int] = None,
        failed: Optional[int] = None,
        add_result: Optional[ScrapeResult] = None,
    ) -> bool:
        """
        Update job state.

        Args:
            job_id: Job identifier
            status: New status
            completed: New completed count
            failed: New failed count
            add_result: Result to add

        Returns:
            True if job exists and was updated
        """
        async with self._write_lock:
            stored = self._jobs.get(job_id)
            if not stored:
                return False

            job = stored.job
            stored.touch()

            if status is not None:
                job.status = status
                if status in (ScrapeStatus.COMPLETED, ScrapeStatus.FAILED, ScrapeStatus.CANCELLED):
                    stored.mark_completed()

            if completed is not None:
                job.completed = completed

            if failed is not None:
                job.failed = failed

            if add_result is not None:
                job.results.append(add_result)
                job.completed = len(job.results)
                if not add_result.success:
                    job.failed += 1

                # Emit event for SSE
                await self._emit_event(job_id, {
                    "type": "result",
                    "data": add_result.model_dump(),
                    "progress": job.progress,
                })

            return True

    async def delete(self, job_id: str) -> bool:
        """
        Delete a job.

        Args:
            job_id: Job identifier

        Returns:
            True if job was deleted
        """
        async with self._write_lock:
            if job_id in self._jobs:
                del self._jobs[job_id]
                self._cancelled_jobs.discard(job_id)

                # Clean up event queue
                if job_id in self._job_events:
                    del self._job_events[job_id]

                logger.info(f"Deleted job {job_id}")
                return True
            return False

    async def cancel(self, job_id: str) -> bool:
        """
        Request job cancellation.

        Args:
            job_id: Job identifier

        Returns:
            True if cancellation was requested
        """
        if job_id in self._jobs:
            self._cancelled_jobs.add(job_id)
            await self._emit_event(job_id, {"type": "cancelled"})
            logger.info(f"Cancellation requested for job {job_id}")
            return True
        return False

    def is_cancelled(self, job_id: str) -> bool:
        """Check if job cancellation was requested."""
        return job_id in self._cancelled_jobs

    async def cleanup_expired(self, max_age_seconds: Optional[int] = None) -> int:
        """
        Clean up expired completed jobs.

        Args:
            max_age_seconds: Override for retention period

        Returns:
            Number of jobs cleaned up
        """
        retention = max_age_seconds or self._job_retention_seconds
        cleaned = 0

        async with self._write_lock:
            expired_ids = []

            for job_id, stored in self._jobs.items():
                # Only clean completed jobs
                if stored.completed_at is not None:
                    if stored.completion_age_seconds >= retention:
                        expired_ids.append(job_id)

            for job_id in expired_ids:
                del self._jobs[job_id]
                self._cancelled_jobs.discard(job_id)
                if job_id in self._job_events:
                    del self._job_events[job_id]
                cleaned += 1

        return cleaned

    async def _evict_lru(self) -> None:
        """Evict least recently used completed job."""
        # First try to evict completed jobs
        for job_id, stored in self._jobs.items():
            if stored.completed_at is not None:
                del self._jobs[job_id]
                if job_id in self._job_events:
                    del self._job_events[job_id]
                logger.debug(f"Evicted LRU job {job_id}")
                return

        # If no completed jobs, evict oldest
        if self._jobs:
            oldest_id = next(iter(self._jobs))
            del self._jobs[oldest_id]
            if oldest_id in self._job_events:
                del self._job_events[oldest_id]
            logger.warning(f"Evicted oldest running job {oldest_id} (max jobs reached)")

    async def _emit_event(self, job_id: str, event: Dict[str, Any]) -> None:
        """Emit event for SSE streaming."""
        if job_id in self._job_events:
            await self._job_events[job_id].put(event)

    async def subscribe(self, job_id: str) -> AsyncIterator[Dict[str, Any]]:
        """
        Subscribe to job events for SSE streaming.

        Args:
            job_id: Job identifier

        Yields:
            Event dictionaries
        """
        if job_id not in self._job_events:
            return

        queue = self._job_events[job_id]

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield event

                # Check for completion events
                if event.get("type") in ("completed", "failed", "cancelled"):
                    break

            except asyncio.TimeoutError:
                # Send keepalive
                yield {"type": "keepalive"}
            except asyncio.CancelledError:
                break

    async def list_jobs(
        self,
        status: Optional[ScrapeStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ScrapeJob]:
        """
        List jobs with optional filtering.

        Args:
            status: Filter by status
            limit: Maximum jobs to return
            offset: Offset for pagination

        Returns:
            List of ScrapeJob objects
        """
        jobs = []

        for stored in self._jobs.values():
            if status is None or stored.job.status == status:
                jobs.append(stored.job)

        return jobs[offset:offset + limit]

    @property
    def job_count(self) -> int:
        """Total number of stored jobs."""
        return len(self._jobs)

    @property
    def active_job_count(self) -> int:
        """Number of running jobs."""
        return sum(
            1 for s in self._jobs.values()
            if s.job.status == ScrapeStatus.RUNNING
        )

    async def shutdown(self) -> None:
        """Shutdown job store and cleanup resources."""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        logger.info("JobStore shutdown complete")
