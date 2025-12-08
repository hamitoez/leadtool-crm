"""
Monitoring script for the worker.
Shows queue status, recent extractions, and statistics.
"""

import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import json
from config import Config


class WorkerMonitor:
    """Monitor worker status and statistics."""

    def __init__(self):
        """Initialize monitor."""
        self.redis_client = redis.from_url(Config.REDIS_URL, decode_responses=True)
        self.db_conn = psycopg2.connect(Config.DATABASE_URL)

    def get_queue_stats(self):
        """Get queue statistics."""
        queue_length = self.redis_client.llen(Config.REDIS_QUEUE_NAME)

        return {
            'queue_length': queue_length,
            'queue_name': Config.REDIS_QUEUE_NAME,
        }

    def get_extraction_stats(self, hours: int = 24):
        """Get extraction statistics for the last N hours."""
        with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Status breakdown
            cur.execute("""
                SELECT status, COUNT(*) as count
                FROM extractions
                WHERE created_at > NOW() - INTERVAL '%s hours'
                GROUP BY status
            """, (hours,))
            status_counts = {row['status']: row['count'] for row in cur.fetchall()}

            # Average processing time
            cur.execute("""
                SELECT AVG(processing_time) as avg_time,
                       MIN(processing_time) as min_time,
                       MAX(processing_time) as max_time
                FROM extractions
                WHERE status = 'COMPLETED'
                AND created_at > NOW() - INTERVAL '%s hours'
                AND processing_time IS NOT NULL
            """, (hours,))
            timing = cur.fetchone()

            # Average confidence
            cur.execute("""
                SELECT AVG(confidence) as avg_confidence
                FROM extractions
                WHERE status IN ('COMPLETED', 'PARTIAL')
                AND created_at > NOW() - INTERVAL '%s hours'
            """, (hours,))
            confidence_row = cur.fetchone()

            # Entity counts
            cur.execute("""
                SELECT entity_type, COUNT(*) as count
                FROM extracted_entities ee
                JOIN extractions e ON e.id = ee.extraction_id
                WHERE e.created_at > NOW() - INTERVAL '%s hours'
                GROUP BY entity_type
            """, (hours,))
            entity_counts = {row['entity_type']: row['count'] for row in cur.fetchall()}

            return {
                'status_counts': status_counts,
                'avg_processing_time_ms': int(timing['avg_time']) if timing['avg_time'] else 0,
                'min_processing_time_ms': int(timing['min_time']) if timing['min_time'] else 0,
                'max_processing_time_ms': int(timing['max_time']) if timing['max_time'] else 0,
                'avg_confidence': float(confidence_row['avg_confidence']) if confidence_row['avg_confidence'] else 0.0,
                'entity_counts': entity_counts,
            }

    def get_recent_extractions(self, limit: int = 10):
        """Get recent extractions."""
        with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, url, status, confidence, processing_time, created_at
                FROM extractions
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return cur.fetchall()

    def get_failed_extractions(self, limit: int = 10):
        """Get recent failed extractions."""
        with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, url, error, created_at
                FROM extractions
                WHERE status = 'FAILED'
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return cur.fetchall()

    def print_dashboard(self):
        """Print monitoring dashboard."""
        print("\n" + "="*80)
        print("LEADTOOL WORKER MONITORING DASHBOARD")
        print("="*80)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # Queue stats
        queue_stats = self.get_queue_stats()
        print("QUEUE STATUS")
        print("-"*80)
        print(f"Queue Name: {queue_stats['queue_name']}")
        print(f"Pending Jobs: {queue_stats['queue_length']}")
        print()

        # Extraction stats (24h)
        extraction_stats = self.get_extraction_stats(24)
        print("EXTRACTIONS (Last 24 hours)")
        print("-"*80)
        print("Status Breakdown:")
        for status, count in extraction_stats['status_counts'].items():
            print(f"  {status:12} : {count:4}")
        print()
        print(f"Average Processing Time: {extraction_stats['avg_processing_time_ms']}ms")
        print(f"Min/Max Processing Time: {extraction_stats['min_processing_time_ms']}ms / {extraction_stats['max_processing_time_ms']}ms")
        print(f"Average Confidence: {extraction_stats['avg_confidence']:.2f}")
        print()
        print("Entity Counts:")
        for entity_type, count in extraction_stats['entity_counts'].items():
            print(f"  {entity_type:15} : {count:4}")
        print()

        # Recent extractions
        recent = self.get_recent_extractions(5)
        print("RECENT EXTRACTIONS")
        print("-"*80)
        for ext in recent:
            print(f"{ext['created_at'].strftime('%H:%M:%S')} | "
                  f"{ext['status']:10} | "
                  f"Conf: {ext['confidence']:.2f} | "
                  f"{ext['processing_time'] or 0:5}ms | "
                  f"{ext['url'][:50]}")
        print()

        # Failed extractions
        failed = self.get_failed_extractions(5)
        if failed:
            print("RECENT FAILURES")
            print("-"*80)
            for ext in failed:
                print(f"{ext['created_at'].strftime('%H:%M:%S')} | "
                      f"{ext['url'][:40]:40} | "
                      f"{ext['error'][:30] if ext['error'] else 'N/A'}")
            print()

        print("="*80)

    def close(self):
        """Close connections."""
        self.redis_client.close()
        self.db_conn.close()


def main():
    """Main entry point."""
    import time
    import sys

    # Check for watch mode
    watch = '--watch' in sys.argv
    interval = 5  # seconds

    monitor = WorkerMonitor()

    try:
        while True:
            # Clear screen (works on most terminals)
            if watch:
                print('\033[2J\033[H')  # ANSI escape codes

            monitor.print_dashboard()

            if not watch:
                break

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\nMonitoring stopped.")
    finally:
        monitor.close()


if __name__ == "__main__":
    main()
