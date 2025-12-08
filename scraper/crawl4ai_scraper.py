"""
Crawl4AI-based Scraper with AI-powered extraction
Uses LLMs to intelligently extract contact information
"""
import asyncio
import json
import re
from typing import Dict, List, Optional, Any
from urllib.parse import urljoin, urlparse

try:
    from crawl4ai import AsyncWebCrawler
    from crawl4ai.extraction_strategy import LLMExtractionStrategy, JsonCssExtractionStrategy
    CRAWL4AI_AVAILABLE = True
except ImportError:
    CRAWL4AI_AVAILABLE = False
    print("Warning: crawl4ai not installed. Install with: pip install crawl4ai")

import config
from extractors import extract_all_contacts


# Schema for contact extraction
CONTACT_SCHEMA = {
    "name": "ContactInformation",
    "baseSelector": "body",
    "fields": [
        {
            "name": "emails",
            "selector": "a[href^='mailto:'], [class*='email'], [class*='mail']",
            "type": "list",
            "transform": "text"
        },
        {
            "name": "phones",
            "selector": "a[href^='tel:'], [class*='phone'], [class*='tel']",
            "type": "list",
            "transform": "text"
        },
        {
            "name": "company_name",
            "selector": "h1, [class*='company'], [class*='brand'], title",
            "type": "text"
        },
        {
            "name": "address",
            "selector": "address, [class*='address'], [itemtype*='PostalAddress']",
            "type": "text"
        },
    ]
}

# LLM prompt for contact extraction
EXTRACTION_PROMPT = """
Analysiere den Webseiteninhalt und extrahiere alle Kontaktinformationen.

Finde und extrahiere:
1. E-Mail-Adressen (alle gefundenen)
2. Telefonnummern (alle gefundenen, mit Ländervorwahl wenn möglich)
3. Postanschrift (Straße, PLZ, Stadt)
4. Ansprechpartner/Kontaktpersonen (Name, Position, direkte Kontaktdaten)
5. Social Media Links (LinkedIn, Facebook, Instagram, Xing, etc.)

Gib das Ergebnis als JSON zurück mit dieser Struktur:
{
    "emails": ["email1@example.com", "email2@example.com"],
    "phones": ["+49 123 456789", "+49 987 654321"],
    "address": "Musterstraße 123, 12345 Berlin",
    "persons": [
        {"name": "Max Mustermann", "position": "Geschäftsführer", "email": "max@example.com", "phone": "+49 123 456"}
    ],
    "social": {
        "linkedin": "https://linkedin.com/company/...",
        "facebook": "https://facebook.com/...",
        "instagram": "https://instagram.com/..."
    }
}

Wichtig:
- Extrahiere NUR tatsächlich vorhandene Informationen
- Keine erfundenen oder Beispieldaten
- Validiere E-Mail-Formate und Telefonnummern
- Bei mehreren Ansprechpartnern alle auflisten
"""


class Crawl4AIScraper:
    """Crawl4AI-based scraper with LLM extraction"""

    def __init__(self, api_key: str = None, provider: str = "anthropic"):
        self.api_key = api_key
        self.provider = provider
        self.crawler: Optional[AsyncWebCrawler] = None

    async def _get_crawler(self) -> AsyncWebCrawler:
        """Get or create crawler instance"""
        if self.crawler is None:
            self.crawler = AsyncWebCrawler(verbose=False)
            await self.crawler.awarmup()
        return self.crawler

    async def close(self):
        """Close crawler"""
        if self.crawler:
            await self.crawler.aclose()
            self.crawler = None

    async def scrape_page(self, url: str, use_ai: bool = True) -> Dict:
        """Scrape a single page"""
        if not CRAWL4AI_AVAILABLE:
            return {"error": "crawl4ai not installed"}

        crawler = await self._get_crawler()

        try:
            # First, get the raw content
            result = await crawler.arun(
                url=url,
                bypass_cache=True,
            )

            if not result.success:
                return {"error": f"Failed to crawl {url}"}

            # Extract contacts from HTML using our extractors
            contacts = extract_all_contacts(result.html, url)

            # If AI extraction is enabled and we have an API key
            if use_ai and self.api_key:
                ai_contacts = await self._extract_with_ai(url, result.markdown)
                if ai_contacts:
                    contacts = self._merge_contacts(contacts, ai_contacts)

            contacts['source_url'] = url
            contacts['success'] = True
            return contacts

        except Exception as e:
            return {"error": str(e), "source_url": url, "success": False}

    async def _extract_with_ai(self, url: str, content: str) -> Optional[Dict]:
        """Use LLM to extract contacts from content"""
        if not self.api_key:
            return None

        try:
            if self.provider == "anthropic":
                return await self._extract_with_anthropic(content)
            elif self.provider == "openai":
                return await self._extract_with_openai(content)
            elif self.provider == "google":
                return await self._extract_with_google(content)
            else:
                return None
        except Exception as e:
            print(f"AI extraction error: {e}")
            return None

    async def _extract_with_anthropic(self, content: str) -> Optional[Dict]:
        """Extract using Anthropic Claude"""
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=self.api_key)

            # Truncate content if too long
            max_chars = 50000
            if len(content) > max_chars:
                content = content[:max_chars] + "\n\n[Content truncated...]"

            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                messages=[
                    {
                        "role": "user",
                        "content": f"{EXTRACTION_PROMPT}\n\nWebseiteninhalt:\n{content}"
                    }
                ]
            )

            # Parse response
            text = response.content[0].text

            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                return json.loads(json_match.group())

        except Exception as e:
            print(f"Anthropic extraction error: {e}")

        return None

    async def _extract_with_openai(self, content: str) -> Optional[Dict]:
        """Extract using OpenAI GPT"""
        try:
            from openai import OpenAI

            client = OpenAI(api_key=self.api_key)

            max_chars = 50000
            if len(content) > max_chars:
                content = content[:max_chars] + "\n\n[Content truncated...]"

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": f"{EXTRACTION_PROMPT}\n\nWebseiteninhalt:\n{content}"
                    }
                ],
                max_tokens=2000,
                response_format={"type": "json_object"}
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            print(f"OpenAI extraction error: {e}")

        return None

    async def _extract_with_google(self, content: str) -> Optional[Dict]:
        """Extract using Google Gemini"""
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-1.5-pro')

            max_chars = 50000
            if len(content) > max_chars:
                content = content[:max_chars] + "\n\n[Content truncated...]"

            response = model.generate_content(
                f"{EXTRACTION_PROMPT}\n\nWebseiteninhalt:\n{content}"
            )

            # Extract JSON from response
            text = response.text
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                return json.loads(json_match.group())

        except Exception as e:
            print(f"Google extraction error: {e}")

        return None

    def _merge_contacts(self, base: Dict, ai_result: Dict) -> Dict:
        """Merge AI-extracted contacts with base contacts"""
        # Merge emails
        if 'emails' in ai_result:
            for email in ai_result['emails']:
                if email and email not in base.get('emails', []):
                    base.setdefault('emails', []).append(email)

        # Merge phones
        if 'phones' in ai_result:
            for phone in ai_result['phones']:
                if phone and phone not in base.get('phones', []):
                    base.setdefault('phones', []).append(phone)

        # Merge address
        if ai_result.get('address') and not base.get('addresses'):
            base['addresses'] = [ai_result['address']]

        # Merge persons
        if 'persons' in ai_result:
            existing_names = {p.get('name', '').lower() for p in base.get('persons', [])}
            for person in ai_result['persons']:
                if person.get('name', '').lower() not in existing_names:
                    base.setdefault('persons', []).append(person)

        # Merge social
        if 'social' in ai_result:
            for platform, link in ai_result['social'].items():
                if platform and link:
                    base.setdefault('social', {})[platform] = link

        return base

    async def scrape_website(self, url: str, use_ai: bool = True) -> Dict:
        """Scrape a website including contact pages"""
        all_contacts = {
            'emails': [],
            'phones': [],
            'addresses': [],
            'social': {},
            'persons': [],
            'source_url': url,
            'pages_scraped': [],
        }

        if not CRAWL4AI_AVAILABLE:
            return {"error": "crawl4ai not installed", **all_contacts}

        try:
            # 1. Scrape main page
            main_result = await self.scrape_page(url, use_ai=use_ai)
            if main_result.get('success'):
                all_contacts = self._merge_all_contacts(all_contacts, main_result)
                all_contacts['pages_scraped'].append(url)

            # 2. Find contact pages
            contact_pages = await self._find_contact_pages(url)

            # 3. Scrape contact pages
            for page_url in contact_pages:
                if page_url in all_contacts['pages_scraped']:
                    continue

                await asyncio.sleep(config.REQUEST_DELAY)

                page_result = await self.scrape_page(page_url, use_ai=use_ai)
                if page_result.get('success'):
                    all_contacts = self._merge_all_contacts(all_contacts, page_result)
                    all_contacts['pages_scraped'].append(page_url)

                # Stop if we have enough data
                if (all_contacts['emails'] and all_contacts['phones'] and
                        len(all_contacts['pages_scraped']) >= 3):
                    break

        except Exception as e:
            all_contacts['error'] = str(e)

        all_contacts['success'] = bool(all_contacts['emails'] or all_contacts['phones'])
        return all_contacts

    async def _find_contact_pages(self, base_url: str) -> List[str]:
        """Find contact-related pages"""
        contact_urls = []

        # Add common paths
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        for path in config.CONTACT_PAGES:
            contact_urls.append(urljoin(base, path))

        return contact_urls[:5]

    def _merge_all_contacts(self, target: Dict, source: Dict) -> Dict:
        """Merge all contact data"""
        for key in ['emails', 'phones', 'addresses']:
            for item in source.get(key, []):
                if item and item not in target.get(key, []):
                    target.setdefault(key, []).append(item)

        for platform, link in source.get('social', {}).items():
            if platform and link:
                target.setdefault('social', {})[platform] = link

        existing_names = {p.get('name', '').lower() for p in target.get('persons', [])}
        for person in source.get('persons', []):
            if person.get('name', '').lower() not in existing_names:
                target.setdefault('persons', []).append(person)

        return target


async def scrape_with_crawl4ai(
    url: str,
    api_key: str = None,
    provider: str = "anthropic",
    use_ai: bool = True
) -> Dict:
    """Async function to scrape with Crawl4AI"""
    scraper = Crawl4AIScraper(api_key=api_key, provider=provider)
    try:
        return await scraper.scrape_website(url, use_ai=use_ai)
    finally:
        await scraper.close()


# Test
if __name__ == "__main__":
    import sys

    async def main():
        if len(sys.argv) > 1:
            test_url = sys.argv[1]
        else:
            test_url = "https://example.com"

        result = await scrape_with_crawl4ai(test_url, use_ai=False)
        print("\n=== Crawl4AI Results ===")
        print(f"Emails: {result.get('emails', [])}")
        print(f"Phones: {result.get('phones', [])}")
        print(f"Addresses: {result.get('addresses', [])}")
        print(f"Social: {result.get('social', {})}")
        print(f"Persons: {result.get('persons', [])}")
        print(f"Pages scraped: {result.get('pages_scraped', [])}")

    asyncio.run(main())
