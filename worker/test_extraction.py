"""
Test script for the extraction pipeline.
Can be used to test extraction without Redis queue.
"""

import asyncio
import logging
from main import ExtractionPipeline
from database import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_extraction(url: str):
    """
    Test extraction for a single URL.

    Args:
        url: URL to test
    """
    logger.info(f"Testing extraction for: {url}")

    # Create a test extraction record
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            # Create test project, table, and row
            cur.execute("""
                INSERT INTO users (id, email, name, created_at, updated_at)
                VALUES ('test-user', 'test@example.com', 'Test User', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """)

            cur.execute("""
                INSERT INTO projects (id, user_id, name, created_at, updated_at)
                VALUES ('test-project', 'test-user', 'Test Project', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """)

            cur.execute("""
                INSERT INTO tables (id, project_id, name, created_at, updated_at)
                VALUES ('test-table', 'test-project', 'Test Table', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """)

            cur.execute("""
                INSERT INTO rows (id, table_id, position, created_at, updated_at)
                VALUES ('test-row', 'test-table', 0, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                RETURNING id
            """)
            row_id = cur.fetchone()[0]

            # Create extraction record
            cur.execute("""
                INSERT INTO extractions (
                    id, row_id, url, normalized_url, status, created_at, updated_at
                )
                VALUES (
                    'test-extraction', %s, %s, %s, 'PENDING', NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    url = EXCLUDED.url,
                    normalized_url = EXCLUDED.normalized_url,
                    status = 'PENDING',
                    updated_at = NOW()
                RETURNING id
            """, (row_id, url, url))
            extraction_id = cur.fetchone()[0]

    logger.info(f"Created extraction record: {extraction_id}")

    # Run extraction
    pipeline = ExtractionPipeline()
    await pipeline.fetcher.start()

    try:
        job = {
            'extractionId': extraction_id,
            'url': url,
            'rowId': row_id,
        }
        await pipeline.process(job)
    finally:
        await pipeline.fetcher.close()

    # Get results
    extraction = db.get_extraction(extraction_id)
    entities = db.get_extracted_entities(extraction_id)

    logger.info("\n" + "="*80)
    logger.info("EXTRACTION RESULTS")
    logger.info("="*80)
    logger.info(f"Status: {extraction['status']}")
    logger.info(f"Confidence: {extraction['confidence']}")
    logger.info(f"Processing Time: {extraction.get('processing_time', 0)}ms")
    logger.info(f"Total Entities: {len(entities)}")
    logger.info("\nExtracted Entities:")
    logger.info("-"*80)

    for entity in entities:
        logger.info(
            f"{entity['entity_type']:15} | {entity['value']:40} | "
            f"Confidence: {entity['confidence']:.2f} | Source: {entity['source']}"
        )

    logger.info("="*80)

    # Show LLM stats if used
    if pipeline.llm_extractor.total_requests > 0:
        stats = pipeline.llm_extractor.get_stats()
        logger.info(f"\nLLM Usage: {stats['total_requests']} requests, "
                   f"Cost: ${stats['total_cost_usd']:.4f}")


async def test_multiple_urls(urls: list[str]):
    """
    Test extraction for multiple URLs.

    Args:
        urls: List of URLs to test
    """
    for url in urls:
        logger.info("\n\n")
        await test_extraction(url)
        logger.info("\n" + "="*80 + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python test_extraction.py <url> [url2] [url3] ...")
        print("\nExample:")
        print("  python test_extraction.py https://example.com")
        print("  python test_extraction.py https://site1.com https://site2.com")
        sys.exit(1)

    urls = sys.argv[1:]
    asyncio.run(test_multiple_urls(urls))
