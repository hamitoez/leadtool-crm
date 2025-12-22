# -*- coding: utf-8 -*-
"""HTML parser optimized for German Impressum pages.

This module provides pluggable parsing strategies for extracting
contact information from legal disclosure pages.
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from bs4 import BeautifulSoup
import re
import structlog

from ..utils.text_cleaner import TextCleaner

logger = structlog.get_logger(__name__)


class ParserStrategy(ABC):
    """
    Abstract base class for parsing strategies.

    Implement this interface to create custom parsers for different
    countries, languages, or page formats.
    """

    @abstractmethod
    def parse(self, html_content: str) -> Dict[str, Any]:
        """
        Parse HTML content and extract contact information.

        Args:
            html_content: Raw HTML content

        Returns:
            Dictionary with extracted data including:
            - text: Cleaned text content
            - emails: List of email addresses
            - phones: List of phone numbers
            - names: List of name dicts with first_name/last_name
            - positions: List of position/title strings
            - address: Extracted address or None
        """
        pass

    @abstractmethod
    def get_text_for_llm(self, html_content: str, max_length: int) -> str:
        """
        Extract and prepare text for LLM processing.

        Args:
            html_content: Raw HTML content
            max_length: Maximum text length

        Returns:
            Cleaned, truncated text for LLM context
        """
        pass

    @property
    @abstractmethod
    def country_code(self) -> str:
        """Return ISO country code this parser is optimized for."""
        pass


class GermanImpressumParser(ParserStrategy):
    """
    Parser optimized for German Impressum pages.

    Handles common patterns in German legal disclosure pages including:
    - German phone number formats
    - German postal codes (PLZ)
    - Common German titles and positions
    - Email deobfuscation patterns
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

    # Patterns for name extraction - properly encoded UTF-8
    NAME_PATTERNS = [
        # "Max Mustermann" or "Dr. Max Mustermann"
        r"(?:Dr\.|Prof\.|Dipl\.[\-\w]*\.?)?\s*([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß\-]+)",
        # "Mustermann, Max"
        r"([A-ZÄÖÜ][a-zäöüß\-]+),\s*([A-ZÄÖÜ][a-zäöüß]+)",
    ]

    # Common German titles/positions - properly encoded UTF-8
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
        """Initialize the German Impressum parser."""
        self._text_cleaner = TextCleaner()
        self._log = logger.bind(parser="german")

    def parse(self, html_content: str) -> Dict[str, Any]:
        """
        Parse HTML content and extract contact information.

        Extraction priority:
        1. Structured data (JSON-LD) - highest reliability
        2. Direct mailto:/tel: links
        3. Text extraction with regex

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

            # PRIORITY 0: Extract structured data (JSON-LD) - highest reliability
            structured = self.extract_structured_data(html_content)

            # PRIORITY 1: Extract direct mailto:/tel: links (high reliability)
            direct_links = self.extract_direct_links(html_content)

            # Remove unwanted elements for text extraction
            for element in soup(["script", "style", "nav", "header", "aside"]):
                element.decompose()

            # Get text content (keep footer for now)
            text = soup.get_text(separator="\n", strip=True)

            # Clean text
            text = self._clean_text(text)

            # Extract data from text
            emails = TextCleaner.extract_emails(text)
            phones = TextCleaner.extract_phone_numbers(text)
            names = self._extract_names(text)
            positions = self._extract_positions(text)
            address = self._extract_address(text)

            # PRIORITY: Structured data has highest priority
            if structured:
                if structured.get("email") and structured["email"] not in emails:
                    emails.insert(0, structured["email"])
                if structured.get("phone") and structured["phone"] not in phones:
                    phones.insert(0, structured["phone"])
                # Use structured address if no address found
                if not address and structured.get("address"):
                    address = structured["address"]

            # PRIORITY: Direct links have second-highest priority
            for email in reversed(direct_links["emails"]):
                if email not in emails:
                    emails.insert(0, email)
            for phone in reversed(direct_links["phones"]):
                if phone not in phones:
                    phones.insert(0, phone)

            # Prioritize personal emails (but keep structured/direct links at top if personal)
            emails = TextCleaner.prioritize_emails(emails)

            return {
                "text": text,
                "emails": emails,
                "phones": phones,
                "names": names,
                "positions": positions,
                "address": address,
                "raw_html": html_content[:5000],  # Keep first 5KB for LLM fallback
                "structured_data": structured,  # Include for debugging/logging
            }

        except Exception as e:
            self._log.error("parse_error", error=str(e))
            return self._empty_result()

    def extract_direct_links(self, html_content: str) -> Dict[str, List[str]]:
        """
        Extract email/phone directly from mailto: and tel: links.

        These links have highest reliability since they are explicitly
        provided as contact methods.

        Args:
            html_content: Raw HTML content

        Returns:
            Dict with 'emails' and 'phones' lists
        """
        soup = BeautifulSoup(html_content, "lxml")
        results: Dict[str, List[str]] = {"emails": [], "phones": []}

        # mailto: links
        for link in soup.find_all("a", href=re.compile(r"^mailto:", re.I)):
            href = link.get("href", "")
            # Remove mailto: prefix and query parameters
            email = href.replace("mailto:", "").split("?")[0].strip().lower()
            # Validate email format
            if re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
                if email not in results["emails"]:
                    results["emails"].append(email)

        # tel: links
        for link in soup.find_all("a", href=re.compile(r"^tel:", re.I)):
            href = link.get("href", "")
            # Remove tel: prefix and clean
            phone = href.replace("tel:", "").strip()
            phone = re.sub(r"[^\d+]", "", phone)  # Keep only digits and +
            if len(phone) >= 8:
                if phone not in results["phones"]:
                    results["phones"].append(phone)

        return results

    def extract_footer_contacts(self, html_content: str) -> Dict[str, Any]:
        """
        Extract contact data specifically from footer area.

        Footer often contains contact information even when no
        dedicated Impressum page exists.

        Args:
            html_content: Raw HTML content

        Returns:
            Dict with 'emails', 'phones', and 'text' from footer
        """
        soup = BeautifulSoup(html_content, "lxml")

        # Try multiple footer selectors
        footer = None
        for selector in ["footer", "[class*='footer']", "[id*='footer']", "[role='contentinfo']"]:
            try:
                footer = soup.select_one(selector)
                if footer:
                    break
            except Exception:
                continue

        if not footer:
            return {"emails": [], "phones": [], "text": ""}

        footer_text = footer.get_text(separator="\n", strip=True)

        # Also check for direct links in footer
        footer_html = str(footer)
        direct_links = self.extract_direct_links(footer_html)

        # Extract from text
        emails = TextCleaner.extract_emails(footer_text)
        phones = TextCleaner.extract_phone_numbers(footer_text)

        # Merge direct links (priority)
        for email in direct_links["emails"]:
            if email not in emails:
                emails.insert(0, email)
        for phone in direct_links["phones"]:
            if phone not in phones:
                phones.insert(0, phone)

        return {
            "emails": emails,
            "phones": phones,
            "text": footer_text[:1000],  # For LLM fallback
        }

    def extract_structured_data(self, html_content: str) -> Optional[Dict[str, Any]]:
        """
        Extract contact data from JSON-LD (schema.org).

        Many modern websites have structured data that is more
        reliable than HTML parsing. This method extracts contact
        information from JSON-LD scripts.

        Args:
            html_content: Raw HTML content

        Returns:
            Dict with extracted contact data or None
        """
        import json

        soup = BeautifulSoup(html_content, "lxml")

        RELEVANT_TYPES = ["Organization", "LocalBusiness", "Person", "Corporation"]

        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)

                # Can be single object or array
                items = data if isinstance(data, list) else [data]

                for item in items:
                    schema_type = item.get("@type", "")

                    # Support arrays of types
                    if isinstance(schema_type, list):
                        schema_type = schema_type[0] if schema_type else ""

                    if schema_type not in RELEVANT_TYPES:
                        continue

                    # Extract contact data
                    result = {
                        "email": item.get("email"),
                        "phone": item.get("telephone"),
                        "name": item.get("name"),
                        "address": None,
                        "confidence": 0.9,  # Structured data = high confidence
                    }

                    # Parse address
                    address = item.get("address", {})
                    if isinstance(address, dict):
                        parts = [
                            address.get("streetAddress"),
                            address.get("postalCode"),
                            address.get("addressLocality"),
                        ]
                        result["address"] = ", ".join(p for p in parts if p)
                    elif isinstance(address, str):
                        result["address"] = address

                    # Extract contact point
                    contact_point = item.get("contactPoint", {})
                    if isinstance(contact_point, dict):
                        result["email"] = result["email"] or contact_point.get("email")
                        result["phone"] = result["phone"] or contact_point.get("telephone")

                    # Only return if we have at least email or phone
                    if result["email"] or result["phone"]:
                        self._log.debug("structured_data_found", type=schema_type)
                        return result

            except (json.JSONDecodeError, TypeError, KeyError):
                continue

        return None

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
                    # German articles, prepositions, call-to-action words, page titles, etc.
                    false_positives = [
                        # Articles and prepositions
                        "der", "die", "das", "und", "für", "mit", "bei", "von", "zur", "zum",
                        # Call-to-action words (common false names)
                        "rufen", "schreiben", "kontaktieren", "besuchen", "klicken", "senden",
                        "füllen", "absenden", "anrufen", "hier", "jetzt", "mehr",
                        # Pronouns
                        "sie", "wir", "ihr", "uns", "ihnen",
                        # Page titles and navigation
                        "impressum", "kontakt", "datenschutz", "startseite", "home", "über",
                        # Business terms (often mistaken as names)
                        "firmenwortlaut", "unternehmensgegenstand", "firmenbuchgericht",
                        "geschäftsführer", "gesellschafter", "inhaber", "rechtsanwalt",
                        "kanzlei", "standort", "standorte", "zentrale", "filiale",
                        # Other common false positives
                        "alle", "rechte", "vorbehalten", "teilen", "share",
                    ]
                    if first_name.lower() in false_positives or last_name.lower() in false_positives:
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

        Looks for German PLZ (postal code) patterns.
        """
        # Pattern for German addresses - PLZ Stadt pattern
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

    @property
    def country_code(self) -> str:
        return "DE"

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
            "structured_data": None,
        }


class AustrianImpressumParser(GermanImpressumParser):
    """
    Parser for Austrian Impressum pages.

    Inherits from German parser with Austrian-specific adaptations.
    """

    def _extract_address(self, text: str) -> Optional[str]:
        """Extract Austrian address (4-digit PLZ)."""
        # Austrian PLZ is 4 digits
        plz_pattern = r"\d{4}\s+[A-ZÄÖÜ][a-zäöüß\-\s]+"

        matches = re.findall(plz_pattern, text)

        if matches:
            for match in matches:
                lines = text.split("\n")
                for i, line in enumerate(lines):
                    if match in line:
                        address_parts = []
                        if i > 0:
                            prev_line = lines[i - 1].strip()
                            if re.match(r"^[A-ZÄÖÜ]", prev_line) and len(prev_line) < 100:
                                address_parts.append(prev_line)
                        address_parts.append(line.strip())
                        return ", ".join(address_parts)

            return matches[0]

        return None

    @property
    def country_code(self) -> str:
        return "AT"


class SwissImpressumParser(GermanImpressumParser):
    """
    Parser for Swiss Impressum pages.

    Supports Swiss German content with Swiss-specific patterns.
    """

    def _extract_address(self, text: str) -> Optional[str]:
        """Extract Swiss address (4-digit PLZ with CH prefix option)."""
        # Swiss PLZ with optional CH- prefix
        plz_pattern = r"(?:CH-?)?\d{4}\s+[A-ZÄÖÜ][a-zäöüß\-\s]+"

        matches = re.findall(plz_pattern, text)

        if matches:
            for match in matches:
                lines = text.split("\n")
                for i, line in enumerate(lines):
                    if match in line:
                        address_parts = []
                        if i > 0:
                            prev_line = lines[i - 1].strip()
                            if re.match(r"^[A-ZÄÖÜ]", prev_line) and len(prev_line) < 100:
                                address_parts.append(prev_line)
                        address_parts.append(line.strip())
                        return ", ".join(address_parts)

            return matches[0]

        return None

    @property
    def country_code(self) -> str:
        return "CH"


class ImpressumParser:
    """
    Main parser class with strategy selection.

    Uses the Strategy pattern to select appropriate parser
    based on content or configuration.

    Example:
        parser = ImpressumParser()  # Default German
        parser = ImpressumParser(country="AT")  # Austrian
        parser = ImpressumParser(strategy=CustomParser())  # Custom
    """

    # Available strategies
    STRATEGIES = {
        "DE": GermanImpressumParser,
        "AT": AustrianImpressumParser,
        "CH": SwissImpressumParser,
    }

    def __init__(
        self,
        country: str = "DE",
        strategy: Optional[ParserStrategy] = None,
    ):
        """
        Initialize the parser.

        Args:
            country: ISO country code (DE, AT, CH)
            strategy: Custom parser strategy (overrides country)
        """
        if strategy:
            self._strategy = strategy
        elif country in self.STRATEGIES:
            self._strategy = self.STRATEGIES[country]()
        else:
            self._strategy = GermanImpressumParser()

        self._log = logger.bind(
            parser_strategy=self._strategy.__class__.__name__,
            country=self._strategy.country_code,
        )

    def parse(self, html_content: str) -> Dict[str, Any]:
        """Parse HTML content using selected strategy."""
        return self._strategy.parse(html_content)

    def get_text_for_llm(self, html_content: str, max_length: int = 4000) -> str:
        """Extract text for LLM using selected strategy."""
        return self._strategy.get_text_for_llm(html_content, max_length)

    @classmethod
    def register_strategy(cls, country_code: str, strategy_class: type) -> None:
        """
        Register a custom parser strategy.

        Args:
            country_code: ISO country code
            strategy_class: ParserStrategy subclass
        """
        cls.STRATEGIES[country_code] = strategy_class
