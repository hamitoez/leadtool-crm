"""Semaphore-based rate limiter for async operations."""

import asyncio
from typing import Optional
from contextlib import asynccontextmanager
import time
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Semaphore-based rate limiter with optional requests-per-second limiting.

    Features:
    - Limits concurrent operations via semaphore
    - Optional RPS (requests per second) throttling
    - Context manager for easy usage
    """

    def __init__(
        self,
        max_concurrent: int = 100,
        requests_per_second: Optional[float] = None,
    ):
        """
        Initialize rate limiter.

        Args:
            max_concurrent: Maximum concurrent operations
            requests_per_second: Optional RPS limit (None = unlimited)
        """
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._max_concurrent = max_concurrent
        self._rps = requests_per_second
        self._last_request_time = 0.0
        self._lock = asyncio.Lock()

        # Stats
        self._active_count = 0
        self._total_requests = 0

    @asynccontextmanager
    async def acquire(self):
        """Acquire a slot from the rate limiter."""
        async with self._semaphore:
            # RPS throttling
            if self._rps:
                async with self._lock:
                    now = time.monotonic()
                    min_interval = 1.0 / self._rps
                    elapsed = now - self._last_request_time

                    if elapsed < min_interval:
                        await asyncio.sleep(min_interval - elapsed)

                    self._last_request_time = time.monotonic()

            self._active_count += 1
            self._total_requests += 1

            try:
                yield
            finally:
                self._active_count -= 1

    @property
    def active_count(self) -> int:
        """Number of currently active operations."""
        return self._active_count

    @property
    def total_requests(self) -> int:
        """Total number of requests processed."""
        return self._total_requests

    @property
    def max_concurrent(self) -> int:
        """Maximum concurrent operations allowed."""
        return self._max_concurrent

    def update_concurrency(self, new_max: int) -> None:
        """
        Update maximum concurrency.

        Note: This creates a new semaphore; active operations continue
        with the old limit until they complete.
        """
        self._semaphore = asyncio.Semaphore(new_max)
        self._max_concurrent = new_max
        logger.info(f"Rate limiter concurrency updated to {new_max}")
