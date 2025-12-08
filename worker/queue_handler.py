"""
Redis queue handler for processing extraction jobs.
Consumes jobs from Redis queue and orchestrates the extraction pipeline.
"""

import json
import logging
import asyncio
import signal
from typing import Dict, Any, Optional
from datetime import datetime
import redis
from redis.exceptions import ConnectionError, TimeoutError

from config import Config
from database import db

logger = logging.getLogger(__name__)


class QueueHandler:
    """Redis queue consumer for extraction jobs."""

    def __init__(self):
        """Initialize Redis connection."""
        self.redis_client: Optional[redis.Redis] = None
        self.running = False
        self.current_job: Optional[Dict[str, Any]] = None
        self._connect()

    def _connect(self):
        """Connect to Redis."""
        try:
            self.redis_client = redis.from_url(
                Config.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            # Test connection
            self.redis_client.ping()
            logger.info(f"Connected to Redis at {Config.REDIS_URL}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def listen(self, process_callback):
        """
        Listen for jobs on the queue and process them.

        Args:
            process_callback: Async function to process each job
        """
        self.running = True
        logger.info(f"Listening for jobs on queue: {Config.REDIS_QUEUE_NAME}")

        # Setup graceful shutdown
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                loop.add_signal_handler(sig, lambda: asyncio.create_task(self.shutdown()))
            except NotImplementedError:
                # Windows doesn't support add_signal_handler
                signal.signal(sig, lambda s, f: asyncio.create_task(self.shutdown()))

        while self.running:
            try:
                # Blocking pop with timeout (BRPOP)
                result = self.redis_client.brpop(
                    Config.REDIS_QUEUE_NAME, timeout=1
                )

                if result is None:
                    # Timeout, continue loop
                    await asyncio.sleep(0.1)
                    continue

                queue_name, job_data = result
                job = json.loads(job_data)

                self.current_job = job
                logger.info(f"Received job: {job}")

                # Process the job
                await self._process_job_with_retry(job, process_callback)

                self.current_job = None

            except ConnectionError as e:
                logger.error(f"Redis connection error: {e}")
                await asyncio.sleep(5)
                self._connect()

            except TimeoutError as e:
                logger.error(f"Redis timeout: {e}")
                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error processing queue: {e}", exc_info=True)
                await asyncio.sleep(1)

        logger.info("Queue handler stopped")

    async def _process_job_with_retry(
        self, job: Dict[str, Any], process_callback
    ):
        """
        Process a job with retry logic.

        Args:
            job: Job data containing extractionId, url, rowId
            process_callback: Async function to process the job
        """
        extraction_id = job.get("extractionId")
        url = job.get("url")
        row_id = job.get("rowId")
        retry_count = job.get("retryCount", 0)

        if not extraction_id or not url:
            logger.error(f"Invalid job data: {job}")
            return

        # Update status to PROCESSING
        db.update_extraction_status(
            extraction_id=extraction_id,
            status="PROCESSING",
            progress=0,
            started_at=datetime.now(),
        )

        try:
            # Process the job
            start_time = datetime.now()
            await process_callback(job)
            processing_time = int(
                (datetime.now() - start_time).total_seconds() * 1000
            )

            # Update status to COMPLETED
            db.update_extraction_status(
                extraction_id=extraction_id,
                status="COMPLETED",
                progress=100,
                completed_at=datetime.now(),
                processing_time=processing_time,
            )

            logger.info(
                f"Successfully processed extraction {extraction_id} in {processing_time}ms"
            )

        except Exception as e:
            logger.error(
                f"Error processing extraction {extraction_id}: {e}",
                exc_info=True,
            )

            # Retry logic
            if retry_count < Config.MAX_RETRIES:
                retry_count += 1
                logger.info(
                    f"Retrying extraction {extraction_id} (attempt {retry_count}/{Config.MAX_RETRIES})"
                )

                # Re-queue with incremented retry count
                retry_job = {**job, "retryCount": retry_count}
                self.redis_client.lpush(
                    Config.REDIS_QUEUE_NAME, json.dumps(retry_job)
                )

                # Update status to PENDING for retry
                db.update_extraction_status(
                    extraction_id=extraction_id,
                    status="PENDING",
                    error=f"Retrying (attempt {retry_count}): {str(e)}",
                )

            else:
                # Max retries exceeded, mark as FAILED
                logger.error(
                    f"Max retries exceeded for extraction {extraction_id}"
                )
                db.update_extraction_status(
                    extraction_id=extraction_id,
                    status="FAILED",
                    progress=0,
                    error=f"Failed after {Config.MAX_RETRIES} retries: {str(e)}",
                    completed_at=datetime.now(),
                )

    async def shutdown(self):
        """Graceful shutdown handler."""
        logger.info("Shutting down queue handler...")
        self.running = False

        # Wait for current job to complete
        if self.current_job:
            logger.info(
                f"Waiting for current job to complete: {self.current_job.get('extractionId')}"
            )
            # Give it up to 30 seconds to complete
            for _ in range(30):
                if self.current_job is None:
                    break
                await asyncio.sleep(1)

        # Close Redis connection
        if self.redis_client:
            self.redis_client.close()
            logger.info("Redis connection closed")

    def enqueue_job(
        self, extraction_id: str, url: str, row_id: str
    ) -> bool:
        """
        Manually enqueue a job (for testing or manual triggering).

        Args:
            extraction_id: Extraction ID
            url: URL to process
            row_id: Associated row ID

        Returns:
            True if enqueued successfully
        """
        try:
            job = {
                "extractionId": extraction_id,
                "url": url,
                "rowId": row_id,
                "retryCount": 0,
            }
            self.redis_client.lpush(
                Config.REDIS_QUEUE_NAME, json.dumps(job)
            )
            logger.info(f"Enqueued job for extraction {extraction_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to enqueue job: {e}")
            return False
