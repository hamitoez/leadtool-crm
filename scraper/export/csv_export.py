# -*- coding: utf-8 -*-
"""CSV export functionality with atomic writes.

This module provides secure CSV export with:
- Atomic file writes (temp file + rename)
- Proper error handling
- German Excel compatibility (BOM, semicolon delimiter)
"""

import csv
import os
import tempfile
from typing import List
from pathlib import Path
import structlog

from ..models.impressum import ScrapeResult

logger = structlog.get_logger(__name__)


class ExportError(Exception):
    """Exception raised for export failures."""

    def __init__(self, message: str, filepath: str, original_error: Exception = None):
        self.message = message
        self.filepath = filepath
        self.original_error = original_error
        super().__init__(f"{message}: {filepath}")


def export_to_csv(
    results: List[ScrapeResult],
    filepath: str,
    delimiter: str = ";",
) -> str:
    """
    Export scrape results to CSV file with atomic write.

    Uses semicolon as default delimiter for German Excel compatibility.
    Writes to temp file first, then atomically renames.

    Args:
        results: List of ScrapeResult objects
        filepath: Output file path
        delimiter: CSV delimiter (default: semicolon for German Excel)

    Returns:
        Path to the created file

    Raises:
        ExportError: If export fails with context about the failure
    """
    path = Path(filepath)
    temp_path = None
    log = logger.bind(filepath=str(path), result_count=len(results))

    try:
        # Ensure parent directory exists
        path.parent.mkdir(parents=True, exist_ok=True)

        # Define columns
        columns = [
            "url",
            "success",
            "first_name",
            "last_name",
            "email",
            "phone",
            "position",
            "company",
            "address",
            "confidence",
            "impressum_url",
            "error",
        ]

        # Create temp file in same directory for atomic rename
        fd, temp_path = tempfile.mkstemp(
            suffix=".tmp",
            prefix=path.stem + "_",
            dir=path.parent,
        )

        try:
            # Write to temp file
            with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=columns, delimiter=delimiter)
                writer.writeheader()

                for result in results:
                    row = {
                        "url": result.url,
                        "success": "Ja" if result.success else "Nein",
                        "first_name": result.contact.first_name if result.contact else "",
                        "last_name": result.contact.last_name if result.contact else "",
                        "email": result.contact.email if result.contact else (result.all_emails[0] if result.all_emails else ""),
                        "phone": result.contact.phone if result.contact else (result.all_phones[0] if result.all_phones else ""),
                        "position": result.contact.position if result.contact else "",
                        "company": result.contact.company if result.contact else "",
                        "address": result.contact.address if result.contact else "",
                        "confidence": f"{result.contact.confidence:.0%}" if result.contact else "",
                        "impressum_url": result.impressum_url or "",
                        "error": result.error or "",
                    }
                    writer.writerow(row)

            # Atomic rename
            os.replace(temp_path, path)
            temp_path = None  # Mark as successfully moved

            log.info("csv_export_success")
            return str(path)

        except Exception as e:
            # fd is already closed by os.fdopen context manager
            raise e

    except (IOError, OSError) as e:
        log.error("csv_export_failed", error=str(e))
        raise ExportError(
            f"Failed to write CSV file",
            filepath=str(path),
            original_error=e,
        ) from e

    except Exception as e:
        log.error("csv_export_error", error=str(e))
        raise ExportError(
            f"Unexpected error during CSV export",
            filepath=str(path),
            original_error=e,
        ) from e

    finally:
        # Clean up temp file if it still exists
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass


def export_to_csv_streaming(
    results_iterator,
    filepath: str,
    delimiter: str = ";",
) -> str:
    """
    Export scrape results to CSV file with streaming support.

    Useful for very large result sets to avoid memory issues.

    Args:
        results_iterator: Iterator yielding ScrapeResult objects
        filepath: Output file path
        delimiter: CSV delimiter

    Returns:
        Path to the created file

    Raises:
        ExportError: If export fails
    """
    path = Path(filepath)
    temp_path = None
    row_count = 0

    try:
        path.parent.mkdir(parents=True, exist_ok=True)

        columns = [
            "url", "success", "first_name", "last_name", "email",
            "phone", "position", "company", "address", "confidence",
            "impressum_url", "error",
        ]

        fd, temp_path = tempfile.mkstemp(
            suffix=".tmp",
            prefix=path.stem + "_",
            dir=path.parent,
        )

        try:
            with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=columns, delimiter=delimiter)
                writer.writeheader()

                for result in results_iterator:
                    row = {
                        "url": result.url,
                        "success": "Ja" if result.success else "Nein",
                        "first_name": result.contact.first_name if result.contact else "",
                        "last_name": result.contact.last_name if result.contact else "",
                        "email": result.contact.email if result.contact else (result.all_emails[0] if result.all_emails else ""),
                        "phone": result.contact.phone if result.contact else (result.all_phones[0] if result.all_phones else ""),
                        "position": result.contact.position if result.contact else "",
                        "company": result.contact.company if result.contact else "",
                        "address": result.contact.address if result.contact else "",
                        "confidence": f"{result.contact.confidence:.0%}" if result.contact else "",
                        "impressum_url": result.impressum_url or "",
                        "error": result.error or "",
                    }
                    writer.writerow(row)
                    row_count += 1

            os.replace(temp_path, path)
            temp_path = None

            logger.info("csv_streaming_export_success", filepath=str(path), rows=row_count)
            return str(path)

        except Exception as e:
            raise e

    except (IOError, OSError) as e:
        raise ExportError(
            f"Failed to write CSV file",
            filepath=str(path),
            original_error=e,
        ) from e

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass
