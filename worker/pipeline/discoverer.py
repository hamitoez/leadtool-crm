"""
Page discovery module.
Finds relevant pages (impressum, kontakt, team, about) from homepage.
"""

import re
import logging
from typing import Dict, List, Set
from selectolax.parser import HTMLParser

from config import Config
from pipeline.normalizer import make_absolute_url, is_same_domain
from utils.patterns import LINK_PATTERN

logger = logging.getLogger(__name__)


class Discoverer:
    """Discovers relevant pages from homepage HTML."""

    def __init__(self):
        """Initialize discoverer."""
        self.patterns = Config.DISCOVERY_PATTERNS
        self.link_text_patterns = Config.DISCOVERY_LINK_TEXT

    def discover(self, base_url: str, html: str) -> Dict[str, List[str]]:
        """
        Discover relevant pages from homepage HTML.

        Args:
            base_url: Homepage URL
            html: HTML content

        Returns:
            Dict mapping page_type to list of URLs
        """
        discovered: Dict[str, Set[str]] = {
            'impressum': set(),
            'kontakt': set(),
            'team': set(),
            'about': set(),
        }

        try:
            # Parse HTML
            tree = HTMLParser(html)

            # Extract all links
            links = tree.css('a[href]')

            for link in links:
                href = link.attributes.get('href', '')
                if not href:
                    continue

                # Get link text
                link_text = link.text(strip=True).lower()

                # Make absolute URL
                try:
                    absolute_url = make_absolute_url(base_url, href)
                except Exception:
                    continue

                # Only consider same-domain links
                if not is_same_domain(base_url, absolute_url):
                    continue

                # Check URL patterns
                for page_type, patterns in self.patterns.items():
                    for pattern in patterns:
                        if re.search(pattern, absolute_url, re.IGNORECASE):
                            discovered[page_type].add(absolute_url)
                            logger.debug(
                                f"Discovered {page_type} page via URL pattern: {absolute_url}"
                            )
                            break

                # Check link text patterns
                for page_type, text_patterns in self.link_text_patterns.items():
                    for text_pattern in text_patterns:
                        if text_pattern.lower() in link_text:
                            discovered[page_type].add(absolute_url)
                            logger.debug(
                                f"Discovered {page_type} page via link text: {absolute_url}"
                            )
                            break

        except Exception as e:
            logger.error(f"Error discovering pages: {e}", exc_info=True)

        # Convert sets to lists
        result = {k: list(v) for k, v in discovered.items()}

        # Log summary
        total = sum(len(v) for v in result.values())
        logger.info(f"Discovered {total} relevant pages: {result}")

        return result

    def prioritize_pages(
        self, discovered: Dict[str, List[str]]
    ) -> List[tuple[str, str]]:
        """
        Prioritize discovered pages for fetching.

        Returns list of (page_type, url) tuples in priority order.

        Args:
            discovered: Dict of page_type -> URLs

        Returns:
            List of (page_type, url) tuples
        """
        priority_order = ['impressum', 'kontakt', 'team', 'about']
        prioritized = []

        for page_type in priority_order:
            urls = discovered.get(page_type, [])
            # Take first URL for each type (could be improved with better ranking)
            if urls:
                prioritized.append((page_type, urls[0]))

        logger.info(f"Prioritized {len(prioritized)} pages for fetching")
        return prioritized

    def extract_text_content(self, html: str) -> str:
        """
        Extract clean text content from HTML.

        Removes scripts, styles, and navigation elements.

        Args:
            html: HTML content

        Returns:
            Clean text content
        """
        try:
            tree = HTMLParser(html)

            # Remove script and style tags
            for tag in tree.css('script, style, nav, header, footer'):
                tag.decompose()

            # Get text content
            text = tree.body.text(separator=' ', strip=True)

            # Clean up whitespace
            text = re.sub(r'\s+', ' ', text)

            return text

        except Exception as e:
            logger.error(f"Error extracting text content: {e}")
            return ""
