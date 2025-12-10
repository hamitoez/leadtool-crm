"""JSON export functionality."""

import json
from typing import List
from pathlib import Path

from ..models.impressum import ScrapeResult


def export_to_json(
    results: List[ScrapeResult],
    filepath: str,
    indent: int = 2,
) -> str:
    """
    Export scrape results to JSON file.

    Args:
        results: List of ScrapeResult objects
        filepath: Output file path
        indent: JSON indentation

    Returns:
        Path to the created file
    """
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)

    data = [result.model_dump() for result in results]

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)

    return str(path)
