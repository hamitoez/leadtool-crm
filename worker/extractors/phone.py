"""
Phone number extraction module.
Handles German phone number formats and normalization.
"""

import re
import logging
from typing import List, Set
from dataclasses import dataclass

from utils.patterns import PHONE_PATTERNS, clean_phone_number

logger = logging.getLogger(__name__)


@dataclass
class ExtractedPhone:
    """Extracted phone number with metadata."""
    phone: str  # normalized format
    raw: str  # original format
    source: str  # page_type
    method: str = "regex"
    confidence: float = 0.8


class PhoneExtractor:
    """Extracts and normalizes German phone numbers."""

    def __init__(self):
        """Initialize phone extractor."""
        pass

    def extract(self, text: str, page_type: str) -> List[ExtractedPhone]:
        """
        Extract phone numbers from text.

        Args:
            text: Text content
            page_type: Type of page (impressum, kontakt, etc.)

        Returns:
            List of ExtractedPhone objects
        """
        phones: Set[str] = set()
        phone_data: dict[str, str] = {}  # normalized -> raw

        # Try all phone patterns
        for pattern in PHONE_PATTERNS:
            matches = pattern.findall(text)
            for match in matches:
                # Extract the actual phone number string
                if isinstance(match, tuple):
                    raw_phone = ''.join(match)
                else:
                    raw_phone = match

                # Clean and normalize
                normalized = self._normalize_phone(raw_phone)

                # Validate
                if self._is_valid_phone(normalized):
                    if normalized not in phones:
                        phones.add(normalized)
                        phone_data[normalized] = raw_phone

        # Create ExtractedPhone objects
        results = []
        for normalized in phones:
            raw = phone_data[normalized]

            # Calculate confidence based on format and source
            confidence = self._calculate_confidence(normalized, page_type)

            results.append(ExtractedPhone(
                phone=normalized,
                raw=raw,
                source=page_type,
                method="regex",
                confidence=confidence,
            ))

        logger.info(f"Extracted {len(results)} phone numbers from {page_type} page")
        return results

    def _normalize_phone(self, phone: str) -> str:
        """
        Normalize phone number to +49 format.

        Args:
            phone: Raw phone number

        Returns:
            Normalized phone number
        """
        # Clean the phone number
        cleaned = clean_phone_number(phone)

        # Ensure it starts with +49
        if not cleaned.startswith('+49'):
            if cleaned.startswith('0049'):
                cleaned = '+49' + cleaned[4:]
            elif cleaned.startswith('0'):
                cleaned = '+49' + cleaned[1:]
            elif cleaned.startswith('49'):
                cleaned = '+' + cleaned

        return cleaned

    def _is_valid_phone(self, phone: str) -> bool:
        """
        Validate a normalized phone number.

        Args:
            phone: Normalized phone number

        Returns:
            True if valid
        """
        # Must start with +49
        if not phone.startswith('+49'):
            return False

        # Must have at least 8 digits after country code
        digits = re.sub(r'\D', '', phone[3:])
        if len(digits) < 8:
            return False

        # Must not be too long (max 15 digits total)
        total_digits = re.sub(r'\D', '', phone)
        if len(total_digits) > 15:
            return False

        return True

    def _calculate_confidence(self, phone: str, page_type: str) -> float:
        """
        Calculate confidence score for a phone number.

        Args:
            phone: Normalized phone number
            page_type: Source page type

        Returns:
            Confidence score (0-1)
        """
        confidence = 0.7  # base confidence

        # Source page bonus
        page_scores = {
            'impressum': 0.2,
            'kontakt': 0.25,
            'team': 0.1,
            'about': 0.1,
            'homepage': 0.05,
        }
        confidence += page_scores.get(page_type, 0.0)

        # Format bonus (proper +49 format)
        if phone.startswith('+49'):
            confidence += 0.05

        # Cap at 1.0
        return min(1.0, confidence)
