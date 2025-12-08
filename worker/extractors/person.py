"""
Person/name extraction module.
Extracts person names and roles using rule-based methods.
"""

import re
import logging
from typing import List, Optional, Set
from dataclasses import dataclass

from utils.patterns import (
    ROLE_PATTERNS,
    NAME_PATTERN,
    NAME_TITLES,
    GERMAN_FIRST_NAMES,
)

logger = logging.getLogger(__name__)


@dataclass
class ExtractedPerson:
    """Extracted person with metadata."""
    first_name: str
    last_name: str
    full_name: str
    role: Optional[str] = None
    source: str = ""
    method: str = "rule"
    confidence: float = 0.7


class PersonExtractor:
    """Extracts person names and roles from text."""

    def __init__(self):
        """Initialize person extractor."""
        pass

    def extract(self, text: str, page_type: str) -> List[ExtractedPerson]:
        """
        Extract persons from text.

        Uses rule-based extraction:
        1. Role-based extraction (Geschäftsführer: Max Mustermann)
        2. Pattern-based extraction (names in specific contexts)

        Args:
            text: Text content
            page_type: Type of page (impressum, kontakt, etc.)

        Returns:
            List of ExtractedPerson objects
        """
        persons: List[ExtractedPerson] = []
        seen_names: Set[str] = set()

        # Method 1: Role-based extraction
        role_based = self._extract_role_based(text, page_type)
        for person in role_based:
            name_key = person.full_name.lower()
            if name_key not in seen_names:
                persons.append(person)
                seen_names.add(name_key)

        # Method 2: Context-based extraction (fallback)
        # Only if we didn't find any persons via role-based
        if not persons and page_type in ['impressum', 'team', 'about']:
            context_based = self._extract_context_based(text, page_type)
            for person in context_based:
                name_key = person.full_name.lower()
                if name_key not in seen_names:
                    persons.append(person)
                    seen_names.add(name_key)

        logger.info(f"Extracted {len(persons)} persons from {page_type} page")
        return persons

    def _extract_role_based(self, text: str, page_type: str) -> List[ExtractedPerson]:
        """
        Extract persons using role patterns.

        Args:
            text: Text content
            page_type: Source page type

        Returns:
            List of ExtractedPerson objects
        """
        persons = []

        for pattern, role in ROLE_PATTERNS:
            matches = pattern.finditer(text)
            for match in matches:
                name = match.group(1).strip()

                # Parse name
                parsed = self._parse_name(name)
                if parsed:
                    first_name, last_name = parsed

                    # Calculate confidence
                    confidence = self._calculate_confidence(
                        first_name, last_name, role, page_type, method="role"
                    )

                    persons.append(ExtractedPerson(
                        first_name=first_name,
                        last_name=last_name,
                        full_name=name,
                        role=role,
                        source=page_type,
                        method="role",
                        confidence=confidence,
                    ))

        return persons

    def _extract_context_based(self, text: str, page_type: str) -> List[ExtractedPerson]:
        """
        Extract persons using context patterns.

        Looks for names in specific contexts on impressum/team pages.

        Args:
            text: Text content
            page_type: Source page type

        Returns:
            List of ExtractedPerson objects
        """
        persons = []

        # Find all potential names
        matches = NAME_PATTERN.finditer(text)

        for match in matches:
            name = match.group(1).strip()

            # Parse name
            parsed = self._parse_name(name)
            if parsed:
                first_name, last_name = parsed

                # Validate - at least one should be a known German name
                if not self._is_likely_german_name(first_name, last_name):
                    continue

                # Calculate confidence (lower for context-based)
                confidence = self._calculate_confidence(
                    first_name, last_name, None, page_type, method="pattern"
                )

                persons.append(ExtractedPerson(
                    first_name=first_name,
                    last_name=last_name,
                    full_name=name,
                    role=None,
                    source=page_type,
                    method="pattern",
                    confidence=confidence,
                ))

        return persons

    def _parse_name(self, full_name: str) -> Optional[tuple[str, str]]:
        """
        Parse full name into first and last name.

        Handles titles and multi-part names.

        Args:
            full_name: Full name string

        Returns:
            Tuple of (first_name, last_name) or None
        """
        # Remove titles
        name = full_name
        for title in NAME_TITLES:
            name = re.sub(rf'\b{re.escape(title)}\b', '', name, flags=re.IGNORECASE)
        name = name.strip()

        # Split into parts
        parts = name.split()

        if len(parts) < 2:
            return None

        # Simple case: First Last
        if len(parts) == 2:
            return (parts[0], parts[1])

        # Multiple parts: take first as first name, rest as last name
        first_name = parts[0]
        last_name = ' '.join(parts[1:])

        return (first_name, last_name)

    def _is_likely_german_name(self, first_name: str, last_name: str) -> bool:
        """
        Check if at least one name part is a known German name.

        Args:
            first_name: First name
            last_name: Last name

        Returns:
            True if likely a German name
        """
        # Check first name against known names
        if first_name.lower() in GERMAN_FIRST_NAMES:
            return True

        # Check if name has proper capitalization
        if first_name and first_name[0].isupper():
            if last_name and last_name[0].isupper():
                return True

        return False

    def _calculate_confidence(
        self,
        first_name: str,
        last_name: str,
        role: Optional[str],
        page_type: str,
        method: str,
    ) -> float:
        """
        Calculate confidence score for a person.

        Args:
            first_name: First name
            last_name: Last name
            role: Role (if any)
            page_type: Source page type
            method: Extraction method

        Returns:
            Confidence score (0-1)
        """
        confidence = 0.5  # base confidence

        # Method bonus
        if method == "role":
            confidence += 0.2
        elif method == "pattern":
            confidence += 0.1

        # Role bonus
        if role:
            confidence += 0.15

        # Known name bonus
        if first_name.lower() in GERMAN_FIRST_NAMES:
            confidence += 0.1

        # Page type bonus
        page_scores = {
            'impressum': 0.2,
            'team': 0.15,
            'about': 0.1,
            'kontakt': 0.05,
        }
        confidence += page_scores.get(page_type, 0.0)

        # Cap at 1.0
        return min(1.0, confidence)
