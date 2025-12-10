# -*- coding: utf-8 -*-
"""FastAPI server for the Impressum scraper.

This module provides REST API endpoints for scraping German Impressum pages.
Features:
- Single and bulk URL scraping
- Job management with centralized JobStore
- Server-Sent Events (SSE) for real-time updates
- Prometheus metrics endpoint
- Graceful shutdown handling
- API key authentication via headers
"""

import asyncio
import signal
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List, AsyncGenerator
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uvicorn
import structlog

from .config import ScraperConfig
from .runner import ImpressumScraper
from .core.job_store import JobStore
from .models.impressum import (
    ScrapeResult,
    ScrapeJob,
    ScrapeStatus,
)

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Global state
scraper: Optional[ImpressumScraper] = None
config: Optional[ScraperConfig] = None
job_store: Optional[JobStore] = None
shutdown_event: asyncio.Event = asyncio.Event()

# Metrics
metrics = {
    "requests_total": 0,
    "requests_success": 0,
    "requests_failed": 0,
    "active_jobs": 0,
    "llm_calls_total": 0,
    "total_urls_scraped": 0,
    "request_durations": [],
}


def mask_api_key(key: Optional[str]) -> str:
    """Mask API key for safe logging."""
    if not key:
        return "not-provided"
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


async def get_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    """
    Extract API key from request headers.

    Supports:
    - X-API-Key header
    - Authorization: Bearer <key>

    Args:
        x_api_key: Value from X-API-Key header
        authorization: Value from Authorization header

    Returns:
        Extracted API key or None
    """
    if x_api_key:
        return x_api_key

    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]

    return None


async def get_request_id(request: Request) -> str:
    """Generate or extract request ID for tracing."""
    request_id = request.headers.get("X-Request-ID")
    if not request_id:
        request_id = str(uuid.uuid4())[:8]
    return request_id


def setup_signal_handlers():
    """Setup graceful shutdown signal handlers."""
    def signal_handler(sig, frame):
        logger.info("shutdown_signal_received", signal=sig)
        shutdown_event.set()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager with graceful shutdown."""
    global scraper, config, job_store

    # Startup
    config = ScraperConfig.from_env()
    scraper = ImpressumScraper(config)
    job_store = await JobStore.get_instance()

    logger.info(
        "scraper_started",
        host=config.host,
        port=config.port,
        verify_ssl=config.verify_ssl,
        llm_provider=config.llm_provider,
    )

    setup_signal_handlers()

    yield

    # Shutdown - wait for jobs to complete or mark as interrupted
    logger.info("graceful_shutdown_initiated")

    if job_store:
        # Mark running jobs as interrupted
        running_jobs = await job_store.list_jobs(status=ScrapeStatus.RUNNING)
        for job in running_jobs:
            await job_store.update(job.job_id, status=ScrapeStatus.CANCELLED)
            logger.info("job_interrupted", job_id=job.job_id)

        await job_store.shutdown()

    if scraper:
        await scraper.close()

    logger.info("scraper_shutdown_complete")


app = FastAPI(
    title="Performanty Impressum Scraper",
    description="High-performance scraper for German Impressum pages",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, limit this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class SingleScrapeRequest(BaseModel):
    """Request for scraping a single URL."""
    url: str = Field(..., description="URL to scrape")


class SingleScrapeResponse(BaseModel):
    """Response for single URL scrape."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    request_id: Optional[str] = None


class BulkRequest(BaseModel):
    """Request for bulk scraping."""
    urls: List[str] = Field(..., min_length=1, description="URLs to scrape")
    max_concurrent: int = Field(default=100, ge=1, le=200)


class JobStatusResponse(BaseModel):
    """Response for job status query."""
    job_id: str
    status: str
    total: int
    completed: int
    failed: int
    progress: float
    results: List[Dict[str, Any]] = []


class PaginatedJobResponse(BaseModel):
    """Paginated job results response."""
    job_id: str
    status: str
    total: int
    completed: int
    failed: int
    progress: float
    results: List[Dict[str, Any]]
    offset: int
    limit: int
    has_more: bool


# Health endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": "2.0.0",
        "scraper_ready": scraper is not None,
        "job_store_ready": job_store is not None,
        "timestamp": datetime.utcnow().isoformat(),
    }


# Single URL scrape
@app.post("/scrape", response_model=SingleScrapeResponse)
async def scrape_single(
    request: SingleScrapeRequest,
    api_key: Optional[str] = Depends(get_api_key),
    request_id: str = Depends(get_request_id),
):
    """
    Scrape a single URL for contact information.

    API key can be provided via:
    - X-API-Key header
    - Authorization: Bearer <key>
    """
    global scraper, config, metrics

    start_time = time.time()
    metrics["requests_total"] += 1

    log = logger.bind(request_id=request_id, url=request.url)
    log.info("single_scrape_started", api_key=mask_api_key(api_key))

    if not scraper:
        raise HTTPException(status_code=503, detail="Scraper not initialized")

    # Use provided API key if available
    temp_scraper = None
    if api_key:
        temp_config = ScraperConfig(
            llm_provider=config.llm_provider,
            openai_api_key=api_key if config.llm_provider == "openai" else config.openai_api_key,
            anthropic_api_key=api_key if config.llm_provider == "anthropic" else config.anthropic_api_key,
            model=config.model,
            http_concurrency=config.http_concurrency,
            llm_concurrency=config.llm_concurrency,
            verify_ssl=config.verify_ssl,
            ssl_ca_bundle=config.ssl_ca_bundle,
        )
        temp_scraper = ImpressumScraper(temp_config)
        active_scraper = temp_scraper
    else:
        active_scraper = scraper

    try:
        result = await active_scraper.scrape_url(request.url)

        duration_ms = int((time.time() - start_time) * 1000)
        metrics["request_durations"].append(duration_ms)
        metrics["total_urls_scraped"] += 1

        if result.success:
            metrics["requests_success"] += 1
        else:
            metrics["requests_failed"] += 1

        log.info(
            "single_scrape_completed",
            success=result.success,
            duration_ms=duration_ms,
            extraction_method=result.extraction_method,
        )

        return SingleScrapeResponse(
            success=result.success,
            data=result.to_legacy_format(),
            error=result.error,
            request_id=request_id,
        )

    except Exception as e:
        metrics["requests_failed"] += 1
        log.error("single_scrape_error", error=str(e))
        return SingleScrapeResponse(
            success=False,
            error=str(e),
            request_id=request_id,
        )
    finally:
        if temp_scraper:
            await temp_scraper.close()


# Bulk scrape
@app.post("/scrape/bulk")
async def scrape_bulk(
    request: BulkRequest,
    api_key: Optional[str] = Depends(get_api_key),
    request_id: str = Depends(get_request_id),
):
    """
    Start a bulk scraping job.

    Returns a job ID that can be used to check status.
    API key provided via X-API-Key or Authorization header.
    """
    global config, job_store, metrics

    log = logger.bind(request_id=request_id, url_count=len(request.urls))
    log.info("bulk_scrape_started", api_key=mask_api_key(api_key))

    if not job_store:
        raise HTTPException(status_code=503, detail="Job store not initialized")

    # Create config with provided API key
    job_config = ScraperConfig(
        llm_provider=config.llm_provider,
        openai_api_key=api_key if config.llm_provider == "openai" and api_key else config.openai_api_key,
        anthropic_api_key=api_key if config.llm_provider == "anthropic" and api_key else config.anthropic_api_key,
        ollama_base_url=config.ollama_base_url,
        model=config.model,
        http_concurrency=request.max_concurrent,
        llm_concurrency=min(request.max_concurrent, 50),
        verify_ssl=config.verify_ssl,
        ssl_ca_bundle=config.ssl_ca_bundle,
    )

    # Create job in central store
    job = await job_store.create(request.urls, job_config)

    # Run job in background
    async def run_job():
        job_scraper = ImpressumScraper(job_config)
        try:
            log.info("job_execution_started", job_id=job.job_id)
            await job_store.update(job.job_id, status=ScrapeStatus.RUNNING)
            metrics["active_jobs"] += 1

            await job_scraper.run_job_with_store(
                job_id=job.job_id,
                urls=request.urls,
                job_store=job_store,
            )

            final_job = await job_store.get(job.job_id)
            log.info(
                "job_execution_completed",
                job_id=job.job_id,
                status=final_job.status.value if final_job else "unknown",
                completed=final_job.completed if final_job else 0,
                failed=final_job.failed if final_job else 0,
            )

        except Exception as e:
            log.error("job_execution_failed", job_id=job.job_id, error=str(e))
            await job_store.update(job.job_id, status=ScrapeStatus.FAILED)
        finally:
            metrics["active_jobs"] = max(0, metrics["active_jobs"] - 1)
            await job_scraper.close()

    asyncio.create_task(run_job())

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "total": job.total,
        "max_concurrent": request.max_concurrent,
        "request_id": request_id,
    }


# Job status with pagination
@app.get("/scrape/job/{job_id}")
async def get_job_status(
    job_id: str,
    offset: int = Query(default=0, ge=0, description="Result offset"),
    limit: int = Query(default=100, ge=1, le=1000, description="Result limit"),
    request_id: str = Depends(get_request_id),
):
    """
    Get the status of a scraping job with paginated results.
    """
    global job_store

    if not job_store:
        raise HTTPException(status_code=503, detail="Job store not initialized")

    job = await job_store.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Paginate results
    total_results = len(job.results)
    paginated_results = job.results[offset:offset + limit]
    has_more = (offset + limit) < total_results

    return PaginatedJobResponse(
        job_id=job.job_id,
        status=job.status.value,
        total=job.total,
        completed=job.completed,
        failed=job.failed,
        progress=job.progress,
        results=[r.to_legacy_format() for r in paginated_results],
        offset=offset,
        limit=limit,
        has_more=has_more,
    )


# SSE streaming endpoint
@app.get("/scrape/job/{job_id}/stream")
async def stream_results(
    job_id: str,
    request_id: str = Depends(get_request_id),
):
    """
    Stream job results via Server-Sent Events (SSE).

    Provides real-time updates as URLs are scraped.
    """
    global job_store

    log = logger.bind(request_id=request_id, job_id=job_id)

    if not job_store:
        raise HTTPException(status_code=503, detail="Job store not initialized")

    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events from job store subscription."""
        log.info("sse_stream_started")

        # Send initial state
        yield f"event: status\ndata: {{\n"
        yield f'  "job_id": "{job.job_id}",\n'
        yield f'  "status": "{job.status.value}",\n'
        yield f'  "total": {job.total},\n'
        yield f'  "completed": {job.completed}\n'
        yield f"}}\n\n"

        # Stream updates
        async for event in job_store.subscribe(job_id):
            event_type = event.get("type", "update")

            if event_type == "result":
                import json
                data = json.dumps(event.get("data", {}))
                progress = event.get("progress", 0)
                yield f"event: result\ndata: {data}\n\n"
                yield f"event: progress\ndata: {progress}\n\n"

            elif event_type == "keepalive":
                yield f"event: keepalive\ndata: ping\n\n"

            elif event_type in ("completed", "failed", "cancelled"):
                yield f"event: {event_type}\ndata: done\n\n"
                break

        log.info("sse_stream_ended")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Cancel job
@app.post("/scrape/job/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    request_id: str = Depends(get_request_id),
):
    """Cancel a running job."""
    global job_store

    log = logger.bind(request_id=request_id, job_id=job_id)

    if not job_store:
        raise HTTPException(status_code=503, detail="Job store not initialized")

    success = await job_store.cancel(job_id)

    if success:
        log.info("job_cancelled")
        return {"success": True, "message": "Cancellation requested"}

    raise HTTPException(status_code=404, detail="Job not found")


# Legacy cancel endpoint for backwards compatibility
@app.post("/scrape/job/{job_id}")
async def control_job(
    job_id: str,
    action: dict,
    request_id: str = Depends(get_request_id),
):
    """Control a scraping job (cancel, etc.) - legacy endpoint."""
    if action.get("action") == "cancel":
        return await cancel_job(job_id, request_id)

    raise HTTPException(status_code=400, detail="Invalid action")


# List jobs
@app.get("/scrape/jobs")
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List all jobs with optional filtering."""
    global job_store

    if not job_store:
        raise HTTPException(status_code=503, detail="Job store not initialized")

    filter_status = None
    if status:
        try:
            filter_status = ScrapeStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    jobs = await job_store.list_jobs(status=filter_status, limit=limit, offset=offset)

    return {
        "jobs": [
            {
                "job_id": j.job_id,
                "status": j.status.value,
                "total": j.total,
                "completed": j.completed,
                "failed": j.failed,
                "progress": j.progress,
            }
            for j in jobs
        ],
        "total_count": job_store.job_count,
        "offset": offset,
        "limit": limit,
    }


# Prometheus metrics endpoint
@app.get("/metrics")
async def get_metrics():
    """
    Prometheus-format metrics endpoint.

    Exposes:
    - scraper_requests_total
    - scraper_requests_duration_seconds
    - scraper_active_jobs
    - scraper_llm_calls_total
    - scraper_urls_scraped_total
    """
    global metrics, job_store

    # Calculate average duration
    durations = metrics.get("request_durations", [])
    avg_duration = sum(durations) / len(durations) if durations else 0

    # Build Prometheus format
    lines = [
        "# HELP scraper_requests_total Total number of scrape requests",
        "# TYPE scraper_requests_total counter",
        f"scraper_requests_total {metrics['requests_total']}",
        "",
        "# HELP scraper_requests_success_total Successful scrape requests",
        "# TYPE scraper_requests_success_total counter",
        f"scraper_requests_success_total {metrics['requests_success']}",
        "",
        "# HELP scraper_requests_failed_total Failed scrape requests",
        "# TYPE scraper_requests_failed_total counter",
        f"scraper_requests_failed_total {metrics['requests_failed']}",
        "",
        "# HELP scraper_active_jobs Number of currently active jobs",
        "# TYPE scraper_active_jobs gauge",
        f"scraper_active_jobs {job_store.active_job_count if job_store else 0}",
        "",
        "# HELP scraper_stored_jobs Total number of stored jobs",
        "# TYPE scraper_stored_jobs gauge",
        f"scraper_stored_jobs {job_store.job_count if job_store else 0}",
        "",
        "# HELP scraper_request_duration_ms_avg Average request duration in ms",
        "# TYPE scraper_request_duration_ms_avg gauge",
        f"scraper_request_duration_ms_avg {avg_duration:.2f}",
        "",
        "# HELP scraper_urls_scraped_total Total URLs scraped",
        "# TYPE scraper_urls_scraped_total counter",
        f"scraper_urls_scraped_total {metrics['total_urls_scraped']}",
    ]

    return StreamingResponse(
        iter(["\n".join(lines)]),
        media_type="text/plain; charset=utf-8",
    )


def main():
    """Run the server."""
    config = ScraperConfig.from_env()
    uvicorn.run(
        "scraper.server:app",
        host=config.host,
        port=config.port,
        reload=False,
        workers=1,
    )


if __name__ == "__main__":
    main()
