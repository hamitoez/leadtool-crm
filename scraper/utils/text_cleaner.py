# -*- coding: utf-8 -*-
"""Text cleaning utilities for email and content extraction.

This module provides robust text cleaning and extraction utilities
optimized for German content with proper UTF-8 encoding.
"""

import re
from typing import List, Optional
import html


class TextCleaner:
    """Utilities for cleaning and normalizing extracted text."""

    # Email obfuscation patterns - properly encoded UTF-8
    EMAIL_OBFUSCATION_PATTERNS = [
        # (at) variations
        (r"\s*\(\s*at\s*\)\s*", "@"),
        (r"\s*\[\s*at\s*\]\s*", "@"),
        (r"\s*\{\s*at\s*\}\s*", "@"),
        (r"\s+at\s+", "@"),
        (r"\s*@\s*", "@"),
        # (dot) variations
        (r"\s*\(\s*dot\s*\)\s*", "."),
        (r"\s*\[\s*dot\s*\]\s*", "."),
        (r"\s*\{\s*dot\s*\}\s*", "."),
        (r"\s+dot\s+", "."),
        (r"\s*\(\s*punkt\s*\)\s*", "."),
        (r"\s*\[\s*punkt\s*\]\s*", "."),
        # German variations - properly encoded UTF-8
        (r"\s*\(\s*ät\s*\)\s*", "@"),
        (r"\s*\[\s*ät\s*\]\s*", "@"),
        (r"\s*\(\s*klammeraffe\s*\)\s*", "@"),
        # Spaces around @ and .
        (r"\s+@\s+", "@"),
        (r"\s+\.\s+", "."),
    ]

    # Common German email prefixes to ignore (usually not personal)
    IGNORE_EMAIL_PREFIXES = [
        "info@", "kontakt@", "contact@", "office@", "mail@",
        "hello@", "hallo@", "service@", "support@", "team@",
        "noreply@", "no-reply@", "newsletter@", "marketing@",
        "sales@", "vertrieb@", "bewerbung@", "jobs@", "karriere@",
        "presse@", "press@", "media@", "pr@", "webmaster@",
        "admin@", "postmaster@", "hostmaster@", "abuse@",
        "datenschutz@", "privacy@", "impressum@", "legal@",
        "buchhaltung@", "accounting@", "rechnung@", "invoice@",
    ]

    @classmethod
    def deobfuscate_email(cls, text: str) -> str:
        """
        Remove email obfuscation from text.

        Converts patterns like:
        - name (at) domain (dot) com -> name@domain.com
        - name [at] domain [dot] com -> name@domain.com
        - name (ät) domain (punkt) com -> name@domain.com

        Args:
            text: Input text potentially containing obfuscated emails

        Returns:
            Text with deobfuscated email addresses
        """
        result = text.lower()

        for pattern, replacement in cls.EMAIL_OBFUSCATION_PATTERNS:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        return result

    @classmethod
    def extract_emails(cls, text: str) -> List[str]:
        """
        Extract all email addresses from text after deobfuscation.

        Returns unique, valid email addresses.

        Args:
            text: Input text

        Returns:
            List of unique, validated email addresses
        """
        # First deobfuscate
        clean_text = cls.deobfuscate_email(text)

        # Email regex pattern
        email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"

        # Find all matches
        emails = re.findall(email_pattern, clean_text)

        # Deduplicate and validate
        seen = set()
        valid_emails = []

        for email in emails:
            email_lower = email.lower().strip()

            # Skip duplicates
            if email_lower in seen:
                continue

            # Skip obviously invalid
            if len(email_lower) < 5 or ".." in email_lower:
                continue

            # Skip image/asset extensions
            if any(email_lower.endswith(ext) for ext in [".png", ".jpg", ".gif", ".svg", ".css", ".js"]):
                continue

            seen.add(email_lower)
            valid_emails.append(email_lower)

        return valid_emails

    @classmethod
    def is_personal_email(cls, email: str) -> bool:
        """
        Check if an email appears to be personal (not generic).

        Personal emails like max.mustermann@company.de are preferred
        over generic ones like info@company.de.

        Args:
            email: Email address to check

        Returns:
            True if email appears to be personal
        """
        email_lower = email.lower()

        for prefix in cls.IGNORE_EMAIL_PREFIXES:
            if email_lower.startswith(prefix):
                return False

        return True

    @classmethod
    def prioritize_emails(cls, emails: List[str]) -> List[str]:
        """
        Sort emails with personal emails first.

        Args:
            emails: List of email addresses

        Returns:
            Sorted list with personal emails first
        """
        personal = [e for e in emails if cls.is_personal_email(e)]
        generic = [e for e in emails if not cls.is_personal_email(e)]
        return personal + generic

    @classmethod
    def clean_html_text(cls, html_content: str) -> str:
        """
        Extract clean text from HTML content.

        Args:
            html_content: Raw HTML content

        Returns:
            Cleaned plain text
        """
        # Decode HTML entities
        text = html.unescape(html_content)

        # Remove script and style content
        text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)

        # Remove HTML tags
        text = re.sub(r"<[^>]+>", " ", text)

        # Normalize whitespace
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    @classmethod
    def extract_phone_numbers(cls, text: str) -> List[str]:
        """
        Extract phone numbers from text (DE/AT/CH).

        Supports various phone number formats:
        - +49/+43/+41 format (Germany/Austria/Switzerland)
        - 0049/0043/0041 format
        - National format (0xxx)
        - Grouped format (0xxx) xxxxx
        - International with (0) notation: +43 (0) 680

        Args:
            text: Input text

        Returns:
            List of extracted phone numbers
        """
        # Patterns for German/Austrian/Swiss phone numbers
        patterns = [
            # German +49 and 0049 format
            r"\+49\s*[\d\s/\-()]+",
            r"0049\s*[\d\s/\-()]+",
            # Austrian +43 and 0043 format
            r"\+43\s*[\d\s/\-()]+",
            r"0043\s*[\d\s/\-()]+",
            # Swiss +41 and 0041 format
            r"\+41\s*[\d\s/\-()]+",
            r"0041\s*[\d\s/\-()]+",
            # International with (0) notation: +43 (0) 680 123456
            r"\+\d{2}\s*\(0\)\s*[\d\s/\-]+",
            # National format starting with 0
            r"0\d{2,4}\s*[/\-]?\s*\d{4,}[\d\s/\-]*",
            # Grouped format like (0123) 456789
            r"\(\d{3,5}\)\s*[\d\s/\-]+",
        ]

        phones = []
        seen = set()

        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                # Clean the number
                cleaned = re.sub(r"[^\d+]", "", match)

                # Must have at least 8 digits (excluding country code)
                digits_only = cleaned.lstrip("+")
                if len(digits_only) < 8:
                    continue

                # Skip if too long (probably not a phone)
                if len(digits_only) > 15:
                    continue

                if cleaned not in seen:
                    seen.add(cleaned)
                    phones.append(cleaned)

        return phones

    @classmethod
    def truncate_for_llm(cls, text: str, max_length: int = 4000) -> str:
        """
        Truncate text to fit LLM context while preserving important parts.

        Tries to break at natural paragraph boundaries.

        Args:
            text: Input text
            max_length: Maximum output length

        Returns:
            Truncated text
        """
        if len(text) <= max_length:
            return text

        # Try to find natural break points
        # Prefer breaking at paragraph boundaries
        paragraphs = text.split("\n\n")

        result = []
        current_length = 0

        for para in paragraphs:
            if current_length + len(para) + 2 <= max_length:
                result.append(para)
                current_length += len(para) + 2
            else:
                # Add partial paragraph if it's the first one
                if not result:
                    result.append(para[:max_length])
                break

        return "\n\n".join(result)

    @classmethod
    def normalize_german_text(cls, text: str) -> str:
        """
        Normalize German text for consistent processing.

        Handles:
        - Unicode normalization
        - Common encoding issues
        - German-specific character handling

        Args:
            text: Input text

        Returns:
            Normalized text
        """
        import unicodedata

        # Unicode NFC normalization
        text = unicodedata.normalize("NFC", text)

        # Fix common encoding issues
        # UTF-8 interpreted as Latin-1 (Mojibake)
        encoding_fixes = [
            ("\u00c3\u00a4", "\u00e4"),  # ä
            ("\u00c3\u00b6", "\u00f6"),  # ö
            ("\u00c3\u00bc", "\u00fc"),  # ü
            ("\u00c3\u0084", "\u00c4"),  # Ä
            ("\u00c3\u0096", "\u00d6"),  # Ö
            ("\u00c3\u009c", "\u00dc"),  # Ü
            ("\u00c3\u009f", "\u00df"),  # ß
            ("\u00e2\u0080\u0093", "\u2013"),  # en dash
            ("\u00e2\u0080\u0094", "\u2014"),  # em dash
            ("\u00e2\u0080\u009c", '"'),  # left double quote
            ("\u00e2\u0080\u009d", '"'),  # right double quote
            ("\u00e2\u0080\u0098", "'"),  # left single quote
            ("\u00e2\u0080\u0099", "'"),  # right single quote
        ]

        for wrong, correct in encoding_fixes:
            text = text.replace(wrong, correct)

        return text
