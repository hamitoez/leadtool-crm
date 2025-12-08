"""
Email extraction module.
Handles standard extraction, deobfuscation, and mailto link parsing.
"""

import re
import logging
from typing import List, Dict, Any, Set
from dataclasses import dataclass
from selectolax.parser import HTMLParser

from utils.patterns import (
    EMAIL_PATTERN,
    EMAIL_OBFUSCATION_PATTERNS,
    is_valid_email_domain,
    classify_email,
)

logger = logging.getLogger(__name__)


@dataclass
class ExtractedEmail:
    """Extracted email with metadata."""
    email: str
    source: str  # page_type
    method: str  # extraction method
    classification: str  # personal, role, business
    confidence: float
    context: str = ""  # surrounding text


class EmailExtractor:
    """Extracts emails from HTML and text content."""

    def __init__(self):
        """Initialize email extractor."""
        pass

    def extract(self, html: str, text: str, page_type: str) -> List[ExtractedEmail]:
        """
        Extract emails from HTML and text content.

        Uses multiple extraction methods:
        1. Standard regex on text
        2. Deobfuscation patterns
        3. mailto: links
        4. JavaScript deobfuscation

        Args:
            html: HTML content
            text: Plain text content
            page_type: Type of page (impressum, kontakt, etc.)

        Returns:
            List of ExtractedEmail objects
        """
        emails: Set[str] = set()
        email_data: Dict[str, Dict[str, Any]] = {}

        # Method 1: Standard regex on text
        standard_emails = self._extract_standard(text)
        for email in standard_emails:
            emails.add(email.lower())
            email_data[email.lower()] = {
                'method': 'regex',
                'context': self._get_context(text, email),
            }

        # Method 2: Deobfuscation patterns
        deobfuscated = self._extract_deobfuscated(text)
        for email in deobfuscated:
            if email.lower() not in emails:
                emails.add(email.lower())
                email_data[email.lower()] = {
                    'method': 'deobfuscation',
                    'context': '',
                }

        # Method 3: mailto: links from HTML
        if html:
            mailto_emails = self._extract_mailto_links(html)
            for email in mailto_emails:
                if email.lower() not in emails:
                    emails.add(email.lower())
                    email_data[email.lower()] = {
                        'method': 'mailto',
                        'context': '',
                    }

        # Method 4: JavaScript deobfuscation (simple cases)
        if html:
            js_emails = self._extract_javascript_emails(html)
            for email in js_emails:
                if email.lower() not in emails:
                    emails.add(email.lower())
                    email_data[email.lower()] = {
                        'method': 'javascript',
                        'context': '',
                    }

        # Filter and create ExtractedEmail objects
        results = []
        for email in emails:
            # Validate domain
            if not is_valid_email_domain(email):
                logger.debug(f"Skipping email with invalid domain: {email}")
                continue

            data = email_data.get(email, {})
            classification = classify_email(email)

            # Base confidence by method
            method_confidence = {
                'mailto': 0.9,
                'regex': 0.8,
                'deobfuscation': 0.7,
                'javascript': 0.6,
            }
            confidence = method_confidence.get(data.get('method', 'regex'), 0.7)

            # Adjust confidence by classification
            if classification == 'personal':
                confidence *= 0.8  # Lower confidence for personal emails
            elif classification == 'role':
                confidence *= 1.1  # Higher confidence for role-based emails

            # Adjust confidence by page type
            page_multipliers = {
                'impressum': 1.2,
                'kontakt': 1.15,
                'team': 1.0,
                'about': 1.0,
                'homepage': 0.9,
            }
            confidence *= page_multipliers.get(page_type, 1.0)

            # Cap at 1.0
            confidence = min(1.0, confidence)

            results.append(ExtractedEmail(
                email=email,
                source=page_type,
                method=data.get('method', 'regex'),
                classification=classification,
                confidence=confidence,
                context=data.get('context', ''),
            ))

        logger.info(f"Extracted {len(results)} emails from {page_type} page")
        return results

    def _extract_standard(self, text: str) -> List[str]:
        """Extract emails using standard regex."""
        matches = EMAIL_PATTERN.findall(text)
        return list(set(matches))

    def _extract_deobfuscated(self, text: str) -> List[str]:
        """Extract emails using deobfuscation patterns."""
        emails = []

        for pattern, replacement in EMAIL_OBFUSCATION_PATTERNS:
            # Apply deobfuscation pattern
            deobfuscated = pattern.sub(replacement, text)

            # Extract emails from deobfuscated text
            matches = EMAIL_PATTERN.findall(deobfuscated)
            emails.extend(matches)

        return list(set(emails))

    def _extract_mailto_links(self, html: str) -> List[str]:
        """Extract emails from mailto: links."""
        emails = []

        try:
            tree = HTMLParser(html)

            # Find all mailto links
            for link in tree.css('a[href^="mailto:"]'):
                href = link.attributes.get('href', '')
                if href.startswith('mailto:'):
                    # Extract email (remove mailto: and any query params)
                    email = href[7:].split('?')[0].strip()
                    if EMAIL_PATTERN.match(email):
                        emails.append(email)

        except Exception as e:
            logger.error(f"Error extracting mailto links: {e}")

        return list(set(emails))

    def _extract_javascript_emails(self, html: str) -> List[str]:
        """
        Extract emails from JavaScript obfuscation.

        Handles simple cases like:
        - String.fromCharCode()
        - document.write() with concatenated strings
        """
        emails = []

        try:
            # Pattern 1: String.fromCharCode()
            # Example: String.fromCharCode(105,110,102,111,64,101,120,97,109,112,108,101,46,99,111,109)
            charcode_pattern = re.compile(
                r'String\.fromCharCode\(([0-9,\s]+)\)',
                re.IGNORECASE
            )

            for match in charcode_pattern.finditer(html):
                codes = match.group(1)
                try:
                    # Convert char codes to string
                    chars = [chr(int(c.strip())) for c in codes.split(',')]
                    decoded = ''.join(chars)

                    # Check if it's an email
                    if EMAIL_PATTERN.match(decoded):
                        emails.append(decoded)
                except Exception:
                    continue

            # Pattern 2: Simple string concatenation
            # Example: "info" + "@" + "example.com"
            concat_pattern = re.compile(
                r'["\']([a-zA-Z0-9._%+-]+)["\']\s*\+\s*["\']@["\']\s*\+\s*["\']([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["\']',
                re.IGNORECASE
            )

            for match in concat_pattern.finditer(html):
                email = f"{match.group(1)}@{match.group(2)}"
                if EMAIL_PATTERN.match(email):
                    emails.append(email)

        except Exception as e:
            logger.error(f"Error extracting JavaScript emails: {e}")

        return list(set(emails))

    def _get_context(self, text: str, email: str, context_length: int = 50) -> str:
        """
        Get surrounding context for an email.

        Args:
            text: Full text content
            email: Email to find context for
            context_length: Characters before/after email

        Returns:
            Context string
        """
        try:
            index = text.lower().find(email.lower())
            if index == -1:
                return ""

            start = max(0, index - context_length)
            end = min(len(text), index + len(email) + context_length)

            context = text[start:end].strip()
            return context

        except Exception:
            return ""
