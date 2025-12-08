"""
Validation module for extracted data.
Calculates confidence scores and validates extracted entities.
"""

import logging
from typing import Dict, Any
import re

from pipeline.normalizer import get_domain
from utils.patterns import (
    is_valid_email_domain,
    is_role_based_email,
    is_personal_email,
    EMAIL_PATTERN,
    PHONE_PATTERNS,
)

logger = logging.getLogger(__name__)


class Validator:
    """Validates extracted entities and calculates confidence scores."""

    def validate_email(
        self, email: str, company_url: str, source: str
    ) -> Dict[str, Any]:
        """
        Validate an email and calculate confidence score.

        Factors considered:
        - Email format validity
        - Domain validity (not in blacklist)
        - Domain matches company domain
        - Not a personal email provider
        - Source page type (impressum > kontakt > other)

        Args:
            email: Email address
            company_url: Company website URL
            source: Source page type

        Returns:
            Dict with validation results
        """
        score = 0.0
        flags = []

        # Basic format validation
        if EMAIL_PATTERN.match(email):
            score += 0.2
        else:
            flags.append("invalid_format")
            return {
                "valid": False,
                "confidence": 0.0,
                "flags": flags,
            }

        # Domain validity
        if is_valid_email_domain(email):
            score += 0.2
        else:
            flags.append("blacklisted_domain")

        # Check if personal email
        if is_personal_email(email):
            score -= 0.1
            flags.append("personal_email_provider")
        else:
            score += 0.1

        # Check if role-based
        if is_role_based_email(email):
            score += 0.1
            flags.append("role_based")
        else:
            flags.append("personal_name")

        # Check if domain matches company
        email_domain = email.split('@')[-1].lower()
        company_domain = get_domain(company_url)

        if company_domain and email_domain == company_domain:
            score += 0.3
            flags.append("domain_match")
        else:
            score -= 0.1
            flags.append("domain_mismatch")

        # Source page bonus
        source_scores = {
            'impressum': 0.2,
            'kontakt': 0.15,
            'team': 0.1,
            'about': 0.1,
            'homepage': 0.05,
        }
        score += source_scores.get(source, 0.0)

        # Normalize score to 0-1
        confidence = max(0.0, min(1.0, score))

        return {
            "valid": confidence >= 0.3,
            "confidence": confidence,
            "flags": flags,
            "email_domain": email_domain,
            "company_domain": company_domain,
        }

    def validate_phone(
        self, phone: str, source: str
    ) -> Dict[str, Any]:
        """
        Validate a phone number and calculate confidence score.

        Args:
            phone: Phone number
            source: Source page type

        Returns:
            Dict with validation results
        """
        score = 0.0
        flags = []

        # Check format with patterns
        matches_pattern = False
        for pattern in PHONE_PATTERNS:
            if pattern.search(phone):
                matches_pattern = True
                break

        if matches_pattern:
            score += 0.4
        else:
            flags.append("invalid_format")
            return {
                "valid": False,
                "confidence": 0.0,
                "flags": flags,
            }

        # Length check (should be at least 8 digits after cleaning)
        digit_count = len(re.sub(r'\D', '', phone))
        if digit_count >= 8:
            score += 0.2
        else:
            flags.append("too_short")

        # Source page bonus
        source_scores = {
            'impressum': 0.3,
            'kontakt': 0.25,
            'team': 0.1,
            'about': 0.1,
            'homepage': 0.05,
        }
        score += source_scores.get(source, 0.0)

        # Normalize score to 0-1
        confidence = max(0.0, min(1.0, score))

        return {
            "valid": confidence >= 0.3,
            "confidence": confidence,
            "flags": flags,
            "digit_count": digit_count,
        }

    def validate_person(
        self, first_name: str, last_name: str, role: str, source: str
    ) -> Dict[str, Any]:
        """
        Validate a person entity and calculate confidence score.

        Args:
            first_name: First name
            last_name: Last name
            role: Person's role
            source: Source page type

        Returns:
            Dict with validation results
        """
        score = 0.0
        flags = []

        # Name validation
        if first_name and len(first_name) >= 2:
            score += 0.2
        else:
            flags.append("invalid_first_name")

        if last_name and len(last_name) >= 2:
            score += 0.2
        else:
            flags.append("invalid_last_name")

        # Check for proper capitalization
        if first_name and first_name[0].isupper():
            score += 0.1
        if last_name and last_name[0].isupper():
            score += 0.1

        # Role bonus
        if role:
            score += 0.2
            flags.append("has_role")

        # Source page bonus
        source_scores = {
            'impressum': 0.2,
            'team': 0.15,
            'about': 0.1,
            'kontakt': 0.1,
            'homepage': 0.05,
        }
        score += source_scores.get(source, 0.0)

        # Normalize score to 0-1
        confidence = max(0.0, min(1.0, score))

        return {
            "valid": confidence >= 0.3,
            "confidence": confidence,
            "flags": flags,
        }

    def calculate_overall_confidence(
        self, entities: list[Dict[str, Any]]
    ) -> float:
        """
        Calculate overall confidence score for all extracted entities.

        Uses weighted average based on entity type and count.

        Args:
            entities: List of extracted entities with confidence scores

        Returns:
            Overall confidence score (0-1)
        """
        if not entities:
            return 0.0

        # Weight by entity type
        weights = {
            'EMAIL': 1.5,
            'PHONE': 1.2,
            'PERSON': 1.0,
            'ADDRESS': 0.8,
            'COMPANY_NAME': 0.8,
        }

        total_score = 0.0
        total_weight = 0.0

        for entity in entities:
            entity_type = entity.get('entity_type', '')
            confidence = entity.get('confidence', 0.0)
            weight = weights.get(entity_type, 1.0)

            total_score += confidence * weight
            total_weight += weight

        if total_weight > 0:
            overall = total_score / total_weight
        else:
            overall = 0.0

        return round(overall, 3)
