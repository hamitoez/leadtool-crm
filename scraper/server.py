"""FastAPI server for the Impressum scraper."""

import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
import logging

from .config import ScraperConfig
from .runner import ImpressumScraper
from .models import (
    ScrapeResult,
    ScrapeJob,
    ScrapeStatus,
    BulkScrapeRequest,
    BulkScrapeResponse,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global scraper instance
scraper: Optional[ImpressumScraper] = None
config: Optional[ScraperConfig] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global scraper, config

    # Startup
    config = ScraperConfig.from_env()
    scraper = ImpressumScraper(config)
    logger.info(f"Scraper started on {config.host}:{config.port}")

    yield

    # Shutdown
    if scraper:
        await scraper.close()
    logger.info("Scraper shutdown complete")


app = FastAPI(
    title="LeadTool Impressum Scraper",
    description="High-performance scraper for German Impressum pages",
    version="1.0.0",
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
    api_key: Optional[str] = Field(None, description="OpenAI API key (overrides env)")


class SingleScrapeResponse(BaseModel):
    """Response for single URL scrape."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class JobStatusResponse(BaseModel):
    """Response for job status query."""
    job_id: str
    status: str
    total: int
    completed: int
    failed: int
    progress: float
    results: list = []


class BulkRequest(BaseModel):
    """Request for bulk scraping."""
    urls: list[str] = Field(..., min_length=1, description="URLs to scrape")
    api_key: Optional[str] = Field(None, description="OpenAI API key")
    max_concurrent: int = Field(default=100, ge=1, le=200)


# Health endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "scraper_ready": scraper is not None,
    }


# Single URL scrape
@app.post("/scrape", response_model=SingleScrapeResponse)
async def scrape_single(request: SingleScrapeRequest):
    """
    Scrape a single URL for contact information.
    """
    global scraper, config

    if not scraper:
        raise HTTPException(status_code=503, detail="Scraper not initialized")

    # Use provided API key if available
    if request.api_key:
        temp_config = ScraperConfig(
            openai_api_key=request.api_key,
            model=config.model,
            http_concurrency=config.http_concurrency,
            llm_concurrency=config.llm_concurrency,
        )
        temp_scraper = ImpressumScraper(temp_config)
    else:
        temp_scraper = scraper

    try:
        result = await temp_scraper.scrape_url(request.url)

        return SingleScrapeResponse(
            success=result.success,
            data=result.to_legacy_format(),
            error=result.error,
        )

    except Exception as e:
        logger.error(f"Scrape error: {e}")
        return SingleScrapeResponse(
            success=False,
            error=str(e),
        )
    finally:
        if request.api_key:
            await temp_scraper.close()


# Bulk scrape
@app.post("/scrape/bulk")
async def scrape_bulk(request: BulkRequest, background_tasks: BackgroundTasks):
    """
    Start a bulk scraping job.

    Returns a job ID that can be used to check status.
    """
    global scraper, config

    if not scraper:
        raise HTTPException(status_code=503, detail="Scraper not initialized")

    # Create config with provided API key
    job_config = ScraperConfig(
        openai_api_key=request.api_key or config.openai_api_key,
        model=config.model,
        http_concurrency=request.max_concurrent,
        llm_concurrency=min(request.max_concurrent, 50),
    )

    job_scraper = ImpressumScraper(job_config)

    # Create job
    job = job_scraper.create_job(request.urls)

    # Store job reference immediately (before background task starts)
    if scraper:
        scraper._jobs[job.job_id] = job

    # Run in background - properly schedule the coroutine
    async def run_job():
        try:
            logger.info(f"Starting job {job.job_id} with {len(request.urls)} URLs")
            await job_scraper.run_job(job.job_id, request.urls)
            logger.info(f"Job {job.job_id} completed")
        except Exception as e:
            logger.error(f"Job {job.job_id} failed: {e}")
            job.status = ScrapeStatus.FAILED
        finally:
            await job_scraper.close()

    # Schedule the async task properly
    asyncio.create_task(run_job())

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "total": job.total,
        "turbo_mode": True,
        "max_concurrent": request.max_concurrent,
    }


# Job status
@app.get("/scrape/job/{job_id}")
async def get_job_status(job_id: str):
    """
    Get the status of a scraping job.
    """
    global scraper

    if not scraper:
        raise HTTPException(status_code=503, detail="Scraper not initialized")

    job = scraper.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "total": job.total,
        "completed": job.completed,
        "failed": job.failed,
        "progress": job.progress,
        "results": [r.to_legacy_format() for r in job.results],
    }


# Cancel job
@app.post("/scrape/job/{job_id}")
async def control_job(job_id: str, action: dict):
    """
    Control a scraping job (cancel, etc.).
    """
    global scraper

    if not scraper:
        raise HTTPException(status_code=503, detail="Scraper not initialized")

    if action.get("action") == "cancel":
        success = scraper.cancel_job(job_id)
        return {"success": success, "message": "Cancellation requested" if success else "Job not found"}

    raise HTTPException(status_code=400, detail="Invalid action")


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
