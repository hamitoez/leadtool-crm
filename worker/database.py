"""
Database module for PostgreSQL operations.
Handles connections and CRUD operations for extraction-related tables.
"""

import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager

from config import Config

logger = logging.getLogger(__name__)


class Database:
    """PostgreSQL database connection and operations manager."""

    def __init__(self):
        """Initialize database connection pool."""
        self.pool: Optional[ThreadedConnectionPool] = None
        self._initialize_pool()

    def _initialize_pool(self):
        """Create a connection pool."""
        try:
            self.pool = ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=Config.DATABASE_URL,
            )
            logger.info("Database connection pool initialized")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise

    @contextmanager
    def get_connection(self):
        """Get a connection from the pool with context manager."""
        conn = self.pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database transaction error: {e}")
            raise
        finally:
            self.pool.putconn(conn)

    def update_extraction_status(
        self,
        extraction_id: str,
        status: str,
        progress: Optional[int] = None,
        error: Optional[str] = None,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
        processing_time: Optional[int] = None,
        confidence: Optional[float] = None,
        raw_data: Optional[Dict] = None,
    ) -> bool:
        """
        Update extraction record status and metadata.

        Args:
            extraction_id: ID of the extraction record
            status: Status value (PENDING, PROCESSING, COMPLETED, FAILED, PARTIAL)
            progress: Progress percentage (0-100)
            error: Error message if failed
            started_at: When processing started
            completed_at: When processing completed
            processing_time: Processing duration in milliseconds
            confidence: Overall confidence score (0-1)
            raw_data: Raw extracted data as dict

        Returns:
            True if update successful
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Build dynamic update query
                    updates = ["status = %s", "updated_at = NOW()"]
                    params = [status]

                    if progress is not None:
                        updates.append("progress = %s")
                        params.append(progress)

                    if error is not None:
                        updates.append("error = %s")
                        params.append(error)

                    if started_at is not None:
                        updates.append("started_at = %s")
                        params.append(started_at)

                    if completed_at is not None:
                        updates.append("completed_at = %s")
                        params.append(completed_at)

                    if processing_time is not None:
                        updates.append("processing_time = %s")
                        params.append(processing_time)

                    if confidence is not None:
                        updates.append("confidence = %s")
                        params.append(confidence)

                    if raw_data is not None:
                        updates.append("raw_data = %s")
                        params.append(Json(raw_data))

                    params.append(extraction_id)

                    query = f"""
                        UPDATE extractions
                        SET {', '.join(updates)}
                        WHERE id = %s
                    """

                    cur.execute(query, params)
                    logger.info(
                        f"Updated extraction {extraction_id} to status {status}"
                    )
                    return True

        except Exception as e:
            logger.error(f"Failed to update extraction status: {e}")
            return False

    def get_extraction(self, extraction_id: str) -> Optional[Dict[str, Any]]:
        """
        Get extraction record by ID.

        Args:
            extraction_id: ID of the extraction

        Returns:
            Extraction record as dict or None
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT * FROM extractions WHERE id = %s
                        """,
                        (extraction_id,),
                    )
                    result = cur.fetchone()
                    return dict(result) if result else None

        except Exception as e:
            logger.error(f"Failed to get extraction: {e}")
            return None

    def save_scraped_page(
        self,
        extraction_id: str,
        url: str,
        page_type: str,
        html: Optional[str] = None,
        text_content: Optional[str] = None,
        status_code: Optional[int] = None,
        content_type: Optional[str] = None,
        fetch_time: Optional[int] = None,
        used_browser: bool = False,
    ) -> Optional[str]:
        """
        Save a scraped page record.

        Args:
            extraction_id: Parent extraction ID
            url: Page URL
            page_type: Type of page (homepage, impressum, kontakt, etc.)
            html: HTML content
            text_content: Extracted text content
            status_code: HTTP status code
            content_type: Content-Type header
            fetch_time: Fetch duration in milliseconds
            used_browser: Whether browser was used

        Returns:
            Created page ID or None
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO scraped_pages (
                            extraction_id, url, page_type, html, text_content,
                            status_code, content_type, fetch_time, used_browser,
                            created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        RETURNING id
                        """,
                        (
                            extraction_id,
                            url,
                            page_type,
                            html,
                            text_content,
                            status_code,
                            content_type,
                            fetch_time,
                            used_browser,
                        ),
                    )
                    page_id = cur.fetchone()[0]
                    logger.info(
                        f"Saved scraped page {page_id} ({page_type}) for extraction {extraction_id}"
                    )
                    return page_id

        except Exception as e:
            logger.error(f"Failed to save scraped page: {e}")
            return None

    def save_extracted_entity(
        self,
        extraction_id: str,
        entity_type: str,
        value: str,
        data: Dict[str, Any],
        confidence: float,
        source: str,
        method: str,
        is_fallback: bool = False,
        is_verified: bool = False,
    ) -> Optional[str]:
        """
        Save an extracted entity.

        Args:
            extraction_id: Parent extraction ID
            entity_type: Type (EMAIL, PHONE, PERSON, etc.)
            value: Primary value/text
            data: Additional structured data
            confidence: Confidence score (0-1)
            source: Source page type or "llm"
            method: Extraction method (regex, rule, llm, etc.)
            is_fallback: Whether this is from LLM fallback
            is_verified: Whether this has been verified

        Returns:
            Created entity ID or None
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO extracted_entities (
                            extraction_id, entity_type, value, data, confidence,
                            source, method, is_fallback, is_verified, created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        RETURNING id
                        """,
                        (
                            extraction_id,
                            entity_type,
                            value,
                            Json(data),
                            confidence,
                            source,
                            method,
                            is_fallback,
                            is_verified,
                        ),
                    )
                    entity_id = cur.fetchone()[0]
                    logger.info(
                        f"Saved extracted entity {entity_id} ({entity_type}: {value})"
                    )
                    return entity_id

        except Exception as e:
            logger.error(f"Failed to save extracted entity: {e}")
            return None

    def get_extracted_entities(
        self, extraction_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all entities for an extraction.

        Args:
            extraction_id: Extraction ID

        Returns:
            List of entity records
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT * FROM extracted_entities
                        WHERE extraction_id = %s
                        ORDER BY confidence DESC
                        """,
                        (extraction_id,),
                    )
                    results = cur.fetchall()
                    return [dict(row) for row in results]

        except Exception as e:
            logger.error(f"Failed to get extracted entities: {e}")
            return []

    def update_row_cells(
        self, row_id: str, cell_updates: Dict[str, Any]
    ) -> bool:
        """
        Update cells for a row with extracted data.

        Args:
            row_id: Row ID
            cell_updates: Dict of column_name -> value

        Returns:
            True if successful
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    for column_name, value in cell_updates.items():
                        # Get column ID for this row's table
                        cur.execute(
                            """
                            SELECT c.id FROM columns c
                            JOIN rows r ON r.table_id = c.table_id
                            WHERE r.id = %s AND c.name = %s
                            """,
                            (row_id, column_name),
                        )
                        result = cur.fetchone()
                        if not result:
                            logger.warning(
                                f"Column {column_name} not found for row {row_id}"
                            )
                            continue

                        column_id = result[0]

                        # Upsert cell value
                        cur.execute(
                            """
                            INSERT INTO cells (row_id, column_id, value, metadata, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, NOW(), NOW())
                            ON CONFLICT (row_id, column_id)
                            DO UPDATE SET value = %s, metadata = %s, updated_at = NOW()
                            """,
                            (
                                row_id,
                                column_id,
                                Json(value),
                                Json({"source": "worker", "updated_at": datetime.now().isoformat()}),
                                Json(value),
                                Json({"source": "worker", "updated_at": datetime.now().isoformat()}),
                            ),
                        )

                    logger.info(f"Updated {len(cell_updates)} cells for row {row_id}")
                    return True

        except Exception as e:
            logger.error(f"Failed to update row cells: {e}")
            return False

    def close(self):
        """Close all database connections."""
        if self.pool:
            self.pool.closeall()
            logger.info("Database connection pool closed")


# Singleton instance
db = Database()
