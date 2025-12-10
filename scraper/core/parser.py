"""HTML parser optimized for German Impressum pages."""

from typing import Optional, List, Dict, Any
from bs4 import BeautifulSoup
import re
import logging

from ..utils.text_cleaner import TextCleaner

logger = logging.getLogger(__name__)


class ImpressumParser:
    """
    Parser for German Impressum pages.

    Optimized for extracting contact information from German legal pages.
    Uses BeautifulSoup with lxml for maximum performance.
    """

    # Sections that likely contain contact information
    CONTACT_SECTIONS = [
        "impressum",
        "kontakt",
        "contact",
        "ansprechpartner",
        "geschäftsführer",
        "geschäftsführung",
        "inhaber",
        "verantwortlich",
        "angaben gemäß",
        "vertreten durch",
    ]

    # Patterns for name extraction
    NAME_PATTERNS = [
        # "Max Mustermann" or "Dr. Max Mustermann"
        r"(?:Dr\.|Prof\.|Dipl\.[\-\w]*\.?)?\s*([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß\-]+)",
        # "Mustermann, Max"
        r"([A-ZÄÖÜ][a-zäöüß\-]+),\s*([A-ZÄÖÜ][a-zäöüß]+)",
    ]

    # Common German titles/positions
    POSITION_KEYWORDS = [
        "geschäftsführer",
        "geschäftsführerin",
        "inhaber",
        "inhaberin",
        "gründer",
        "gründerin",
        "ceo",
        "cto",
        "cfo",
        "managing director",
        "vorstand",
        "prokurist",
        "gesellschafter",
    ]

    def __init__(self):
        """Initialize the parser."""
        self._text_cleaner = TextCleaner()

    def parse(self, html_content: str) -> Dict[str, Any]:
        """
        Parse HTML content and extract contact information.

        Args:
            html_content: Raw HTML content

        Returns:
            Dictionary with extracted data
        """
        if not html_content:
            return self._empty_result()

        try:
            # Parse HTML with lxml for speed
            soup = BeautifulSoup(html_content, "lxml")

            # Remove unwanted elements
            for element in soup(["script", "style", "nav", "header", "footer", "aside"]):
                element.decompose()

            # Get text content
            text = soup.get_text(separator="\n", strip=True)

            # Clean text
            text = self._clean_text(text)

            # Extract data
            emails = TextCleaner.extract_emails(text)
            phones = TextCleaner.extract_phone_numbers(text)
            names = self._extract_names(text)
            positions = self._extract_positions(text)
            address = self._extract_address(text)

            # Prioritize personal emails
            emails = TextCleaner.prioritize_emails(emails)

            return {
                "text": text,
                "emails": emails,
                "phones": phones,
                "names": names,
                "positions": positions,
                "address": address,
                "raw_html": html_content[:5000],  # Keep first 5KB for LLM fallback
            }

        except Exception as e:
            logger.error(f"Error parsing HTML: {e}")
            return self._empty_result()

    def _clean_text(self, text: str) -> str:
        """Clean extracted text."""
        # Remove excessive whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" {2,}", " ", text)

        # Remove common navigation text
        nav_patterns = [
            r"^(Home|Startseite|Menü|Menu|Navigation)$",
            r"^(Cookie|Datenschutz|Privacy).*akzeptieren",
        ]

        lines = text.split("\n")
        cleaned_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Skip navigation patterns
            skip = False
            for pattern in nav_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    skip = True
                    break

            if not skip:
                cleaned_lines.append(line)

        return "\n".join(cleaned_lines)

    def _extract_names(self, text: str) -> List[Dict[str, str]]:
        """
        Extract person names from text.

        Returns list of dicts with first_name and last_name.
        """
        names = []
        seen = set()

        for pattern in self.NAME_PATTERNS:
            matches = re.findall(pattern, text)

            for match in matches:
                if len(match) == 2:
                    first_name, last_name = match

                    # Basic validation
                    if len(first_name) < 2 or len(last_name) < 2:
                        continue

                    # Skip common false positives
                    if first_name.lower() in ["der", "die", "das", "und", "für", "mit"]:
                        continue

                    key = f"{first_name.lower()}_{last_name.lower()}"
                    if key not in seen:
                        seen.add(key)
                        names.append({
                            "first_name": first_name,
                            "last_name": last_name,
                        })

        return names[:5]  # Limit to 5 names

    def _extract_positions(self, text: str) -> List[str]:
        """Extract position/title mentions from text."""
        positions = []
        text_lower = text.lower()

        for keyword in self.POSITION_KEYWORDS:
            if keyword in text_lower:
                # Find the line containing the position
                for line in text.split("\n"):
                    if keyword in line.lower():
                        positions.append(line.strip()[:100])
                        break

        return positions[:3]  # Limit to 3

    def _extract_address(self, text: str) -> Optional[str]:
        """
        Extract German address from text.
        """
        # Pattern for German addresses
        # PLZ Stadt pattern
        plz_pattern = r"\d{5}\s+[A-ZÄÖÜ][a-zäöüß\-\s]+"

        matches = re.findall(plz_pattern, text)

        if matches:
            # Try to get surrounding context (street + PLZ + city)
            for match in matches:
                # Find the line and previous line
                lines = text.split("\n")
                for i, line in enumerate(lines):
                    if match in line:
                        # Include previous line if it looks like a street
                        address_parts = []
                        if i > 0:
                            prev_line = lines[i - 1].strip()
                            if re.match(r"^[A-ZÄÖÜ]", prev_line) and len(prev_line) < 100:
                                address_parts.append(prev_line)
                        address_parts.append(line.strip())
                        return ", ".join(address_parts)

            return matches[0]

        return None

    def get_text_for_llm(self, html_content: str, max_length: int = 4000) -> str:
        """
        Extract and prepare text for LLM processing.

        Returns cleaned, truncated text optimized for LLM context.
        """
        result = self.parse(html_content)
        text = result.get("text", "")
        return TextCleaner.truncate_for_llm(text, max_length)

    def _empty_result(self) -> Dict[str, Any]:
        """Return empty result structure."""
        return {
            "text": "",
            "emails": [],
            "phones": [],
            "names": [],
            "positions": [],
            "address": None,
            "raw_html": "",
        }
