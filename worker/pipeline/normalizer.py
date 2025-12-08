"""
URL normalization module.
Handles URL cleaning, validation, and standardization.
"""

import re
from urllib.parse import urlparse, urlunparse
from typing import Optional
import tldextract


def normalize_url(raw_url: str) -> Optional[str]:
    """
    Normalize a URL to a standard format.

    Handles:
    - Missing schema (adds https://)
    - www prefix normalization
    - Lowercase domain
    - Trailing slash removal
    - Query parameter removal (optional)

    Args:
        raw_url: Raw URL string

    Returns:
        Normalized URL or None if invalid
    """
    if not raw_url:
        return None

    # Strip whitespace
    url = raw_url.strip()

    # Add schema if missing
    if not re.match(r'^https?://', url, re.IGNORECASE):
        url = f'https://{url}'

    try:
        # Parse URL
        parsed = urlparse(url)

        # Extract domain parts
        ext = tldextract.extract(url)

        # Validate domain
        if not ext.domain or not ext.suffix:
            return None

        # Normalize domain (lowercase, handle www)
        domain = f'{ext.domain}.{ext.suffix}'
        if ext.subdomain:
            # Keep subdomain if not www
            if ext.subdomain.lower() != 'www':
                domain = f'{ext.subdomain}.{domain}'

        domain = domain.lower()

        # Normalize path (remove trailing slash for homepage)
        path = parsed.path.rstrip('/')
        if not path:
            path = ''

        # Reconstruct URL (without query and fragment for normalization)
        normalized = urlunparse((
            'https',  # Always use https
            domain,
            path,
            '',  # params
            '',  # query (removed for normalization)
            ''   # fragment
        ))

        return normalized

    except Exception:
        return None


def get_domain(url: str) -> Optional[str]:
    """
    Extract domain from URL.

    Args:
        url: URL string

    Returns:
        Domain or None
    """
    try:
        ext = tldextract.extract(url)
        if ext.domain and ext.suffix:
            return f'{ext.domain}.{ext.suffix}'.lower()
        return None
    except Exception:
        return None


def is_same_domain(url1: str, url2: str) -> bool:
    """
    Check if two URLs are from the same domain.

    Args:
        url1: First URL
        url2: Second URL

    Returns:
        True if same domain
    """
    domain1 = get_domain(url1)
    domain2 = get_domain(url2)
    return domain1 is not None and domain1 == domain2


def make_absolute_url(base_url: str, relative_url: str) -> str:
    """
    Convert a relative URL to absolute using base URL.

    Args:
        base_url: Base URL
        relative_url: Relative or absolute URL

    Returns:
        Absolute URL
    """
    # Already absolute
    if re.match(r'^https?://', relative_url, re.IGNORECASE):
        return relative_url

    # Parse base URL
    parsed_base = urlparse(base_url)

    # Handle protocol-relative URLs (//example.com)
    if relative_url.startswith('//'):
        return f'{parsed_base.scheme}:{relative_url}'

    # Handle absolute paths (/path)
    if relative_url.startswith('/'):
        return f'{parsed_base.scheme}://{parsed_base.netloc}{relative_url}'

    # Handle relative paths (path, ./path, ../path)
    base_path = parsed_base.path.rstrip('/')
    if not base_path:
        base_path = ''

    # Simple join (doesn't handle all edge cases but good enough)
    if relative_url.startswith('./'):
        relative_url = relative_url[2:]

    return f'{parsed_base.scheme}://{parsed_base.netloc}{base_path}/{relative_url}'
