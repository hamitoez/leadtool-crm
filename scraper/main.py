"""
FastAPI Server for Web Scraping Service
Provides REST API endpoints for scraping websites
"""
import asyncio
import os
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import uvicorn

import config
from selenium_scraper import SeleniumScraper, scrape_with_selenium
from crawl4ai_scraper import scrape_with_crawl4ai, CRAWL4AI_AVAILABLE
from extractors import extract_all_contacts, extract_contact_with_ai

# Store for background tasks
scrape_jobs: Dict[str, Dict] = {}


# Pydantic Models
class ScrapeRequest(BaseModel):
    url: HttpUrl
    use_selenium: bool = True
    use_crawl4ai: bool = False  # Disabled by default - slower startup
    use_ai: bool = True  # Enabled by default for name extraction
    api_key: Optional[str] = None
    provider: str = "deepseek"  # Supports: deepseek, openai, anthropic, google, groq, mistral


class BulkScrapeRequest(BaseModel):
    urls: List[HttpUrl]
    use_selenium: bool = True
    use_crawl4ai: bool = False  # Disabled by default
    use_ai: bool = True  # Enabled by default
    api_key: Optional[str] = None
    provider: str = "deepseek"  # Supports: deepseek, openai, anthropic, google, groq, mistral


class ScrapeResult(BaseModel):
    success: bool
    url: str
    emails: List[str] = []
    phones: List[str] = []
    addresses: List[str] = []
    social: Dict[str, str] = {}
    persons: List[Dict] = []
    pages_scraped: List[str] = []
    error: Optional[str] = None
    # AI-extracted contact info
    firstName: Optional[str] = None
    lastName: Optional[str] = None


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, running, completed, failed
    progress: int  # 0-100
    total: int
    completed: int
    results: List[ScrapeResult] = []


# Lifespan for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting Scraper API on {config.HOST}:{config.PORT}")
    print(f"Crawl4AI available: {CRAWL4AI_AVAILABLE}")
    yield
    print("Shutting down Scraper API")


# FastAPI App
app = FastAPI(
    title="Lead Scraper API",
    description="Web scraping service for extracting contact information",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "crawl4ai_available": CRAWL4AI_AVAILABLE,
        "selenium_available": True,
    }


@app.post("/scrape", response_model=ScrapeResult)
async def scrape_single(request: ScrapeRequest):
    """Scrape a single URL for contact information"""
    url = str(request.url)
    result = {
        'success': False,
        'url': url,
        'emails': [],
        'phones': [],
        'addresses': [],
        'social': {},
        'persons': [],
        'pages_scraped': [],
        'error': None,
        'firstName': None,
        'lastName': None,
    }

    impressum_html = None

    try:
        # Strategy 1: Try Crawl4AI first (faster, async)
        if request.use_crawl4ai and CRAWL4AI_AVAILABLE:
            api_key = request.api_key or config.ANTHROPIC_API_KEY
            crawl_result = await scrape_with_crawl4ai(
                url,
                api_key=api_key if request.use_ai else None,
                provider=request.provider,
                use_ai=request.use_ai,
            )

            if crawl_result.get('success') or crawl_result.get('emails') or crawl_result.get('phones'):
                merge_results(result, crawl_result)

        # Strategy 2: Use Selenium for JS-heavy sites or as fallback
        if request.use_selenium and (not result['emails'] or not result['phones']):
            selenium_result = await scrape_with_selenium(url, headless=config.HEADLESS)

            if selenium_result:
                merge_results(result, selenium_result)
                # Store impressum HTML for AI extraction
                if selenium_result.get('impressum_html'):
                    impressum_html = selenium_result['impressum_html']

        # Strategy 3: Use AI to extract names from Impressum if enabled
        if request.use_ai and (not result.get('firstName') or not result.get('lastName')):
            api_key = request.api_key or config.ANTHROPIC_API_KEY
            if api_key:
                # Get Impressum HTML if not already available
                if not impressum_html:
                    from selenium_scraper import SeleniumScraper
                    scraper = SeleniumScraper(headless=config.HEADLESS)
                    try:
                        # Find Impressum URL
                        impressum_urls = scraper.find_contact_pages(url)
                        for imp_url in impressum_urls:
                            if 'impressum' in imp_url.lower() or 'imprint' in imp_url.lower():
                                impressum_html = scraper.get_page_source(imp_url)
                                if impressum_html:
                                    result['pages_scraped'].append(imp_url)
                                    break
                    finally:
                        scraper.close()

                # Extract names with AI
                if impressum_html:
                    ai_result = extract_contact_with_ai(
                        impressum_html,
                        api_key=api_key,
                        provider=request.provider
                    )
                    if ai_result.get('firstName'):
                        result['firstName'] = ai_result['firstName']
                    if ai_result.get('lastName'):
                        result['lastName'] = ai_result['lastName']
                    if ai_result.get('email') and ai_result['email'] not in result['emails']:
                        result['emails'].insert(0, ai_result['email'])
                    if ai_result.get('phone') and ai_result['phone'] not in result['phones']:
                        result['phones'].insert(0, ai_result['phone'])

                    # Also add as person
                    if ai_result.get('firstName') or ai_result.get('lastName'):
                        full_name = f"{ai_result.get('firstName', '')} {ai_result.get('lastName', '')}".strip()
                        if full_name:
                            result['persons'].insert(0, {
                                'name': full_name,
                                'email': ai_result.get('email'),
                                'phone': ai_result.get('phone'),
                            })

        result['success'] = bool(result['emails'] or result['phones'] or result.get('firstName'))

    except Exception as e:
        result['error'] = str(e)

    return ScrapeResult(**result)


@app.post("/scrape/bulk")
async def scrape_bulk(request: BulkScrapeRequest, background_tasks: BackgroundTasks):
    """Start bulk scraping job"""
    import uuid

    job_id = str(uuid.uuid4())

    # Initialize job
    scrape_jobs[job_id] = {
        'status': 'pending',
        'progress': 0,
        'total': len(request.urls),
        'completed': 0,
        'results': [],
    }

    # Start background task
    background_tasks.add_task(
        run_bulk_scrape,
        job_id,
        [str(url) for url in request.urls],
        request.use_selenium,
        request.use_crawl4ai,
        request.use_ai,
        request.api_key,
        request.provider,
    )

    return {"job_id": job_id, "status": "pending", "total": len(request.urls)}


@app.get("/scrape/job/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get status of bulk scraping job"""
    if job_id not in scrape_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = scrape_jobs[job_id]
    return JobStatus(
        job_id=job_id,
        status=job['status'],
        progress=job['progress'],
        total=job['total'],
        completed=job['completed'],
        results=[ScrapeResult(**r) for r in job['results']],
    )


async def run_bulk_scrape(
    job_id: str,
    urls: List[str],
    use_selenium: bool,
    use_crawl4ai: bool,
    use_ai: bool,
    api_key: Optional[str],
    provider: str,
):
    """Run bulk scraping in background"""
    job = scrape_jobs[job_id]
    job['status'] = 'running'

    for i, url in enumerate(urls):
        try:
            result = {
                'success': False,
                'url': url,
                'emails': [],
                'phones': [],
                'addresses': [],
                'social': {},
                'persons': [],
                'pages_scraped': [],
                'error': None,
            }

            # Try Crawl4AI
            if use_crawl4ai and CRAWL4AI_AVAILABLE:
                crawl_result = await scrape_with_crawl4ai(
                    url,
                    api_key=api_key if use_ai else None,
                    provider=provider,
                    use_ai=use_ai,
                )
                if crawl_result:
                    merge_results(result, crawl_result)

            # Try Selenium as fallback
            if use_selenium and (not result['emails'] or not result['phones']):
                selenium_result = await scrape_with_selenium(url, headless=config.HEADLESS)
                if selenium_result:
                    merge_results(result, selenium_result)

            result['success'] = bool(result['emails'] or result['phones'])
            job['results'].append(result)

        except Exception as e:
            job['results'].append({
                'success': False,
                'url': url,
                'emails': [],
                'phones': [],
                'addresses': [],
                'social': {},
                'persons': [],
                'pages_scraped': [],
                'error': str(e),
            })

        job['completed'] = i + 1
        job['progress'] = int((i + 1) / len(urls) * 100)

        # Rate limiting
        await asyncio.sleep(config.REQUEST_DELAY)

    job['status'] = 'completed'


def merge_results(target: Dict, source: Dict):
    """Merge scrape results"""
    for key in ['emails', 'phones', 'addresses', 'pages_scraped']:
        for item in source.get(key, []):
            if item and item not in target.get(key, []):
                target[key].append(item)

    for platform, link in source.get('social', {}).items():
        if platform and link:
            target['social'][platform] = link

    existing_names = {p.get('name', '').lower() for p in target.get('persons', [])}
    for person in source.get('persons', []):
        if person.get('name', '').lower() not in existing_names:
            target['persons'].append(person)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )
