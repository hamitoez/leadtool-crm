"""
Selenium-based Web Scraper for JavaScript-heavy websites
"""
import asyncio
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import config
from extractors import extract_all_contacts


class SeleniumScraper:
    """Selenium-based scraper for dynamic content"""

    def __init__(self, headless: bool = True, timeout: int = 30):
        self.headless = headless
        self.timeout = timeout
        self.driver: Optional[webdriver.Chrome] = None

    def _create_driver(self) -> webdriver.Chrome:
        """Create a new Chrome driver instance"""
        options = Options()

        if self.headless:
            options.add_argument("--headless=new")

        # Performance and stability options
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-infobars")

        # Stealth options
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        # User agent
        options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # Additional stealth
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            """
        })

        driver.set_page_load_timeout(self.timeout)
        return driver

    def _ensure_driver(self):
        """Ensure driver is available"""
        if self.driver is None:
            self.driver = self._create_driver()

    def close(self):
        """Close the driver"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None

    def get_page_source(self, url: str) -> Optional[str]:
        """Get page source with JavaScript execution"""
        self._ensure_driver()

        try:
            self.driver.get(url)

            # Wait for page to load
            WebDriverWait(self.driver, self.timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            # Additional wait for dynamic content
            time.sleep(2)

            # Scroll to load lazy content
            self._scroll_page()

            return self.driver.page_source

        except TimeoutException:
            print(f"Timeout loading {url}")
            return None
        except WebDriverException as e:
            print(f"WebDriver error for {url}: {e}")
            return None
        except Exception as e:
            print(f"Error loading {url}: {e}")
            return None

    def _scroll_page(self):
        """Scroll page to trigger lazy loading"""
        try:
            # Scroll down in steps
            total_height = self.driver.execute_script("return document.body.scrollHeight")
            viewport_height = self.driver.execute_script("return window.innerHeight")

            for i in range(0, total_height, viewport_height):
                self.driver.execute_script(f"window.scrollTo(0, {i});")
                time.sleep(0.3)

            # Scroll back to top
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(0.5)

        except Exception:
            pass

    def find_contact_pages(self, base_url: str) -> List[str]:
        """Find links to contact-related pages"""
        self._ensure_driver()
        contact_urls = []

        try:
            self.driver.get(base_url)
            WebDriverWait(self.driver, self.timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            # Find all links
            links = self.driver.find_elements(By.TAG_NAME, "a")

            for link in links:
                try:
                    href = link.get_attribute("href")
                    text = link.text.lower()

                    if not href:
                        continue

                    # Check if it's a contact-related page
                    href_lower = href.lower()
                    contact_keywords = ['kontakt', 'contact', 'impressum', 'imprint',
                                        'about', 'über', 'team', 'ansprechpartner']

                    if any(kw in href_lower or kw in text for kw in contact_keywords):
                        # Make sure it's on the same domain
                        if urlparse(href).netloc == urlparse(base_url).netloc or not urlparse(href).netloc:
                            full_url = urljoin(base_url, href)
                            if full_url not in contact_urls:
                                contact_urls.append(full_url)

                except:
                    continue

        except Exception as e:
            print(f"Error finding contact pages: {e}")

        # Also add common contact page paths
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        for path in config.CONTACT_PAGES:
            url = urljoin(base, path)
            if url not in contact_urls:
                contact_urls.append(url)

        return contact_urls[:10]  # Limit to 10 pages

    def scrape_website(self, url: str) -> Dict:
        """Scrape a website for contact information"""
        all_contacts = {
            'emails': [],
            'phones': [],
            'addresses': [],
            'social': {},
            'persons': [],
            'source_url': url,
            'pages_scraped': [],
        }

        try:
            # 1. Scrape main page
            main_html = self.get_page_source(url)
            if main_html:
                contacts = extract_all_contacts(main_html, url)
                self._merge_contacts(all_contacts, contacts)
                all_contacts['pages_scraped'].append(url)

            # 2. Find and scrape contact pages
            contact_pages = self.find_contact_pages(url)

            for page_url in contact_pages:
                if page_url in all_contacts['pages_scraped']:
                    continue

                time.sleep(config.REQUEST_DELAY)

                page_html = self.get_page_source(page_url)
                if page_html:
                    contacts = extract_all_contacts(page_html, page_url)
                    self._merge_contacts(all_contacts, contacts)
                    all_contacts['pages_scraped'].append(page_url)

                # Stop if we have enough data
                if (all_contacts['emails'] and all_contacts['phones'] and
                        len(all_contacts['pages_scraped']) >= 3):
                    break

        except Exception as e:
            all_contacts['error'] = str(e)

        return all_contacts

    def _merge_contacts(self, target: Dict, source: Dict):
        """Merge contact data from source into target"""
        # Merge lists (deduplicate)
        for key in ['emails', 'phones', 'addresses']:
            for item in source.get(key, []):
                if item not in target[key]:
                    target[key].append(item)

        # Merge social dict
        for platform, link in source.get('social', {}).items():
            if platform not in target['social']:
                target['social'][platform] = link

        # Merge persons
        existing_names = {p.get('name', '').lower() for p in target['persons']}
        for person in source.get('persons', []):
            if person.get('name', '').lower() not in existing_names:
                target['persons'].append(person)


async def scrape_with_selenium(url: str, headless: bool = True) -> Dict:
    """Async wrapper for Selenium scraping"""
    scraper = SeleniumScraper(headless=headless)
    try:
        # Run in thread pool since Selenium is blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, scraper.scrape_website, url)
        return result
    finally:
        scraper.close()


# Test
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        test_url = sys.argv[1]
    else:
        test_url = "https://example.com"

    scraper = SeleniumScraper(headless=True)
    try:
        result = scraper.scrape_website(test_url)
        print("\n=== Scrape Results ===")
        print(f"Emails: {result['emails']}")
        print(f"Phones: {result['phones']}")
        print(f"Addresses: {result['addresses']}")
        print(f"Social: {result['social']}")
        print(f"Persons: {result['persons']}")
        print(f"Pages scraped: {result['pages_scraped']}")
    finally:
        scraper.close()
