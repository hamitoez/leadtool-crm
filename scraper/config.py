"""
Scraper Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

# Server Config
HOST = os.getenv("SCRAPER_HOST", "127.0.0.1")
PORT = int(os.getenv("SCRAPER_PORT", "8765"))

# Selenium Config
HEADLESS = os.getenv("SELENIUM_HEADLESS", "true").lower() == "true"
TIMEOUT = int(os.getenv("SELENIUM_TIMEOUT", "30"))

# Rate Limiting
REQUEST_DELAY = float(os.getenv("REQUEST_DELAY", "1.0"))  # Seconds between requests
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT", "3"))  # Max concurrent scrapes

# Contact Patterns (Regex)
EMAIL_PATTERNS = [
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
]

PHONE_PATTERNS = [
    # German formats
    r'\+49[\s\-]?\d{2,4}[\s\-]?\d{3,8}[\s\-]?\d{0,6}',
    r'0\d{2,4}[\s\-/]?\d{3,8}[\s\-/]?\d{0,6}',
    # International
    r'\+\d{1,3}[\s\-]?\d{2,4}[\s\-]?\d{3,8}[\s\-]?\d{0,6}',
    # Generic
    r'\(?\d{2,5}\)?[\s\-]?\d{3,8}[\s\-]?\d{0,6}',
]

# Pages to check for contact info
CONTACT_PAGES = [
    '/kontakt',
    '/contact',
    '/impressum',
    '/imprint',
    '/about',
    '/ueber-uns',
    '/about-us',
    '/team',
    '/contact-us',
    '/kontaktieren',
]

# Selectors for contact info
CONTACT_SELECTORS = {
    'email': [
        'a[href^="mailto:"]',
        '[class*="email"]',
        '[class*="mail"]',
        '[id*="email"]',
        '[data-email]',
    ],
    'phone': [
        'a[href^="tel:"]',
        '[class*="phone"]',
        '[class*="tel"]',
        '[class*="telefon"]',
        '[id*="phone"]',
        '[data-phone]',
    ],
    'address': [
        '[class*="address"]',
        '[class*="adresse"]',
        '[itemtype*="PostalAddress"]',
        'address',
    ],
    'social': [
        'a[href*="linkedin.com"]',
        'a[href*="facebook.com"]',
        'a[href*="instagram.com"]',
        'a[href*="twitter.com"]',
        'a[href*="xing.com"]',
    ],
    'person': [
        '[class*="team"]',
        '[class*="staff"]',
        '[class*="employee"]',
        '[class*="mitarbeiter"]',
        '[class*="ansprechpartner"]',
    ],
}
