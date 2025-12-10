"""CSV export functionality."""

import csv
from typing import List
from pathlib import Path

from ..models.impressum import ScrapeResult


def export_to_csv(
    results: List[ScrapeResult],
    filepath: str,
    delimiter: str = ";",
) -> str:
    """
    Export scrape results to CSV file.

    Uses semicolon as default delimiter for German Excel compatibility.

    Args:
        results: List of ScrapeResult objects
        filepath: Output file path
        delimiter: CSV delimiter (default: semicolon for German Excel)

    Returns:
        Path to the created file
    """
    path = Path(filepath)
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

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
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

    return str(path)
