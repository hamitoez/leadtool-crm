# -*- coding: utf-8 -*-
"""JSON export functionality with atomic writes.

This module provides secure JSON export with:
- Atomic file writes (temp file + rename)
- Proper error handling
- JSONL streaming support for large datasets
"""

import json
import os
import tempfile
from typing import List, Iterator
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


def export_to_json(
    results: List[ScrapeResult],
    filepath: str,
    indent: int = 2,
) -> str:
    """
    Export scrape results to JSON file with atomic write.

    Writes to temp file first, then atomically renames.

    Args:
        results: List of ScrapeResult objects
        filepath: Output file path
        indent: JSON indentation (default: 2)

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

        # Serialize data
        data = [result.model_dump() for result in results]

        # Create temp file in same directory for atomic rename
        fd, temp_path = tempfile.mkstemp(
            suffix=".tmp",
            prefix=path.stem + "_",
            dir=path.parent,
        )

        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=indent)

            # Atomic rename
            os.replace(temp_path, path)
            temp_path = None  # Mark as successfully moved

            log.info("json_export_success")
            return str(path)

        except Exception as e:
            raise e

    except (IOError, OSError) as e:
        log.error("json_export_failed", error=str(e))
        raise ExportError(
            f"Failed to write JSON file",
            filepath=str(path),
            original_error=e,
        ) from e

    except Exception as e:
        log.error("json_export_error", error=str(e))
        raise ExportError(
            f"Unexpected error during JSON export",
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


def export_to_jsonl(
    results: List[ScrapeResult],
    filepath: str,
) -> str:
    """
    Export scrape results to JSONL (JSON Lines) file.

    Each line is a valid JSON object. Better for streaming
    and processing large datasets.

    Args:
        results: List of ScrapeResult objects
        filepath: Output file path

    Returns:
        Path to the created file

    Raises:
        ExportError: If export fails
    """
    path = Path(filepath)
    temp_path = None
    log = logger.bind(filepath=str(path), result_count=len(results))

    try:
        path.parent.mkdir(parents=True, exist_ok=True)

        fd, temp_path = tempfile.mkstemp(
            suffix=".tmp",
            prefix=path.stem + "_",
            dir=path.parent,
        )

        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                for result in results:
                    line = json.dumps(result.model_dump(), ensure_ascii=False)
                    f.write(line + "\n")

            os.replace(temp_path, path)
            temp_path = None

            log.info("jsonl_export_success")
            return str(path)

        except Exception as e:
            raise e

    except (IOError, OSError) as e:
        log.error("jsonl_export_failed", error=str(e))
        raise ExportError(
            f"Failed to write JSONL file",
            filepath=str(path),
            original_error=e,
        ) from e

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass


def export_to_jsonl_streaming(
    results_iterator: Iterator[ScrapeResult],
    filepath: str,
) -> str:
    """
    Export scrape results to JSONL file with streaming support.

    Writes results as they come, useful for real-time export
    during scraping jobs.

    Args:
        results_iterator: Iterator yielding ScrapeResult objects
        filepath: Output file path

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

        fd, temp_path = tempfile.mkstemp(
            suffix=".tmp",
            prefix=path.stem + "_",
            dir=path.parent,
        )

        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                for result in results_iterator:
                    line = json.dumps(result.model_dump(), ensure_ascii=False)
                    f.write(line + "\n")
                    row_count += 1

            os.replace(temp_path, path)
            temp_path = None

            logger.info("jsonl_streaming_export_success", filepath=str(path), rows=row_count)
            return str(path)

        except Exception as e:
            raise e

    except (IOError, OSError) as e:
        raise ExportError(
            f"Failed to write JSONL file",
            filepath=str(path),
            original_error=e,
        ) from e

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass
