"""
Script to manually enqueue extraction jobs to Redis.
Useful for testing and manual triggering.
"""

import sys
import json
from queue_handler import QueueHandler
from database import db


def enqueue_extraction_job(url: str):
    """
    Create an extraction record and enqueue a job.

    Args:
        url: URL to extract from
    """
    # Create test records
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            # Create test user
            cur.execute("""
                INSERT INTO users (id, email, name, created_at, updated_at)
                VALUES ('test-user', 'test@example.com', 'Test User', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """)

            # Create test project
            cur.execute("""
                INSERT INTO projects (id, user_id, name, created_at, updated_at)
                VALUES ('test-project', 'test-user', 'Test Project', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """)

            # Create test table
            cur.execute("""
                INSERT INTO tables (id, project_id, name, created_at, updated_at)
                VALUES ('test-table', 'test-project', 'Test Table', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """)

            # Create row
            cur.execute("""
                INSERT INTO rows (id, table_id, position, created_at, updated_at)
                VALUES (gen_random_uuid()::text, 'test-table', 0, NOW(), NOW())
                RETURNING id
            """)
            row_id = cur.fetchone()[0]

            # Create extraction record
            cur.execute("""
                INSERT INTO extractions (
                    id, row_id, url, normalized_url, status, created_at, updated_at
                )
                VALUES (
                    gen_random_uuid()::text, %s, %s, %s, 'PENDING', NOW(), NOW()
                )
                RETURNING id
            """, (row_id, url, url))
            extraction_id = cur.fetchone()[0]

    print(f"Created extraction record: {extraction_id}")
    print(f"Row ID: {row_id}")

    # Enqueue job
    queue_handler = QueueHandler()
    success = queue_handler.enqueue_job(extraction_id, url, row_id)

    if success:
        print(f"✓ Job enqueued successfully for {url}")
        print(f"  Extraction ID: {extraction_id}")
        print(f"  Queue: {queue_handler.redis_client.llen('extraction-queue')} jobs pending")
    else:
        print(f"✗ Failed to enqueue job")


def enqueue_multiple(urls: list[str]):
    """
    Enqueue multiple URLs.

    Args:
        urls: List of URLs
    """
    for i, url in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] Processing: {url}")
        enqueue_extraction_job(url)
        print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python enqueue_job.py <url> [url2] [url3] ...")
        print("\nExample:")
        print("  python enqueue_job.py https://example.com")
        print("  python enqueue_job.py https://site1.com https://site2.com")
        sys.exit(1)

    urls = sys.argv[1:]
    enqueue_multiple(urls)
