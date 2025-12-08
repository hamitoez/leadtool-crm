"""
Contact Information Extractors
Extracts emails, phones, addresses, and person names from HTML content
"""
import re
import phonenumbers
import requests
import logging
from email_validator import validate_email, EmailNotValidError
from bs4 import BeautifulSoup
from typing import List, Dict, Set, Optional
from urllib.parse import urljoin, urlparse
import config

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def extract_contact_with_ai(html: str, api_key: str = None, provider: str = "deepseek") -> Dict:
    """
    Use AI to extract contact information from Impressum HTML.
    Uses 2-step approach proven in user's DeepSeek scripts for better accuracy.
    """
    if not api_key:
        return {}

    # Limit HTML size to avoid token limits
    soup = BeautifulSoup(html, 'lxml')
    # Remove scripts and styles
    for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
        tag.decompose()
    text_content = soup.get_text(separator='\n', strip=True)
    # Limit to 8000 characters
    if len(text_content) > 8000:
        text_content = text_content[:8000]

    result = {}

    # 2-STEP APPROACH (proven in user's working scripts)
    # Step 1: Extract name
    name_prompt = (
        "Gehe auf die Seite Impressum und gib mir nur den Vornamen und Nachnamen der ersten Person in der Geschäftsführung zurück. "
        "Mögliche Bezeichnungen: Geschäftsführer, Geschäftsführerin, Inhaber, Inhaberin, Verantwortlicher für die Inhalte, Vertreten durch. "
        "Output: nur 'Vorname Nachname'. Keine Erklärungen.\n\n"
        f"Text:\n---\n{text_content}\n---\n"
    )

    # Step 2: Extract email
    email_prompt = (
        "Lies das Impressum-HTML und extrahiere nur die **erste** E-Mail-Adresse. "
        "Output zum Beispiel: max@mustermann.de - exakt nur die Adresse, keine Erklärungen.\n\n"
        f"Text:\n---\n{text_content}\n---\n"
    )

    try:
        # Get name
        name_response = _call_ai_simple(name_prompt, api_key, provider)
        if name_response and '@' not in name_response and len(name_response) < 100:
            # Parse name into first/last
            name_parts = name_response.strip().split()
            if len(name_parts) >= 2:
                result['firstName'] = name_parts[0]
                result['lastName'] = ' '.join(name_parts[1:])
                result['fullName'] = name_response.strip()
                logging.info(f"AI extracted name: {name_response.strip()}")
            elif len(name_parts) == 1:
                result['firstName'] = name_parts[0]
                logging.info(f"AI extracted partial name: {name_parts[0]}")

        # Get email
        email_response = _call_ai_simple(email_prompt, api_key, provider)
        if email_response and '@' in email_response:
            # Clean email - extract just the email address
            email_match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', email_response)
            if email_match:
                result['email'] = email_match.group(0).lower()
                logging.info(f"AI extracted email: {result['email']}")

        return result

    except Exception as e:
        logging.error(f"AI extraction error: {e}")
        return {}


def _call_ai_simple(prompt: str, api_key: str, provider: str) -> str:
    """Call AI API and return raw text response (for 2-step approach)"""
    try:
        if provider == "deepseek":
            return _call_deepseek_simple(prompt, api_key)
        elif provider == "google":
            return _call_google_simple(prompt, api_key)
        elif provider == "anthropic":
            return _call_anthropic_simple(prompt, api_key)
        elif provider == "openai":
            return _call_openai_simple(prompt, api_key)
        elif provider == "groq":
            return _call_groq_simple(prompt, api_key)
        elif provider == "mistral":
            return _call_mistral_simple(prompt, api_key)
        else:
            logging.warning(f"Unknown AI provider: {provider}")
            return ""
    except Exception as e:
        logging.error(f"AI call error ({provider}): {e}")
        return ""


def _call_deepseek_simple(prompt: str, api_key: str) -> str:
    """Call DeepSeek API and return raw text"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "Du bist ein Experte für Web Scraping."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 300,
        "temperature": 0.3
    }
    response = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()
    result = response.json()
    return result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def _call_google_simple(prompt: str, api_key: str) -> str:
    """Call Google Gemini API and return raw text"""
    data = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    models = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-pro"]
    for model in models:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                json=data,
                timeout=30
            )
            if response.status_code == 200:
                result = response.json()
                return result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
            elif response.status_code == 429:
                logging.warning(f"Gemini quota exceeded for {model}")
                continue
        except Exception as e:
            logging.error(f"Gemini API error with {model}: {e}")
            continue
    return ""


def _call_anthropic_simple(prompt: str, api_key: str) -> str:
    """Call Anthropic API and return raw text"""
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 300,
        "messages": [{"role": "user", "content": prompt}]
    }
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()
    result = response.json()
    return result.get("content", [{}])[0].get("text", "").strip()


def _call_openai_simple(prompt: str, api_key: str) -> str:
    """Call OpenAI API and return raw text"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
        "temperature": 0.3
    }
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()
    result = response.json()
    return result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def _call_groq_simple(prompt: str, api_key: str) -> str:
    """Call Groq API and return raw text (fast, free tier available)"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "Du bist ein Experte für Web Scraping."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 300,
        "temperature": 0.3
    }
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()
    result = response.json()
    return result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def _call_mistral_simple(prompt: str, api_key: str) -> str:
    """Call Mistral API and return raw text"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "mistral-small-latest",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
        "temperature": 0.3
    }
    response = requests.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()
    result = response.json()
    return result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def _call_anthropic(prompt: str, api_key: str) -> Dict:
    """Call Anthropic API"""
    import json

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    data = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 300,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()

    result = response.json()
    content = result.get("content", [{}])[0].get("text", "")

    # Parse JSON from response
    return _parse_ai_response(content)


def _call_openai(prompt: str, api_key: str) -> Dict:
    """Call OpenAI API"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 300,
        "temperature": 0.3
    }

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()

    result = response.json()
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

    return _parse_ai_response(content)


def _call_deepseek(prompt: str, api_key: str) -> Dict:
    """Call DeepSeek API (cheapest option)"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 300,
        "temperature": 0.3
    }

    response = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()

    result = response.json()
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

    return _parse_ai_response(content)


def _call_google(prompt: str, api_key: str) -> Dict:
    """Call Google Gemini API"""
    data = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }

    # Try different Gemini models (newest first)
    models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-pro"]

    for model in models:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                json=data,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                content = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                logging.info(f"Gemini {model} response received")
                return _parse_ai_response(content)
            elif response.status_code == 429:
                logging.warning(f"Gemini quota exceeded for {model}")
                continue
            elif response.status_code == 404:
                logging.warning(f"Gemini model {model} not found, trying next...")
                continue
            else:
                logging.error(f"Gemini API error: {response.status_code} - {response.text[:200]}")
                continue

        except Exception as e:
            logging.error(f"Gemini API error with {model}: {e}")
            continue

    logging.error("All Gemini models failed")
    return {}


def _parse_ai_response(content: str) -> Dict:
    """Parse AI response to extract contact info"""
    import json

    # Try to extract JSON from response
    try:
        # Find JSON in response
        json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())

            result = {}
            if parsed.get("vorname") and parsed.get("nachname"):
                result["firstName"] = parsed["vorname"]
                result["lastName"] = parsed["nachname"]
                result["fullName"] = f"{parsed['vorname']} {parsed['nachname']}"
            elif parsed.get("vorname"):
                result["firstName"] = parsed["vorname"]
            elif parsed.get("nachname"):
                result["lastName"] = parsed["nachname"]

            if parsed.get("email"):
                result["email"] = parsed["email"]

            if parsed.get("telefon"):
                result["phone"] = parsed["telefon"]

            logging.info(f"AI extracted: {result}")
            return result
    except json.JSONDecodeError as e:
        logging.error(f"JSON parse error: {e}")

    return {}


def clean_text(text: str) -> str:
    """Clean text by removing extra whitespace"""
    if not text:
        return ""
    return " ".join(text.split()).strip()


def extract_emails(html: str, soup: BeautifulSoup = None) -> List[str]:
    """Extract email addresses from HTML"""
    emails: Set[str] = set()

    if soup is None:
        soup = BeautifulSoup(html, 'lxml')

    # 1. From mailto links
    for link in soup.select('a[href^="mailto:"]'):
        href = link.get('href', '')
        email = href.replace('mailto:', '').split('?')[0].strip()
        if email:
            emails.add(email.lower())

    # 2. From data attributes
    for elem in soup.select('[data-email], [data-mail]'):
        email = elem.get('data-email') or elem.get('data-mail')
        if email:
            emails.add(email.lower())

    # 3. From text content using regex
    text = soup.get_text()
    for pattern in config.EMAIL_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            emails.add(match.lower())

    # 4. From href attributes that might be obfuscated
    for link in soup.find_all('a'):
        href = link.get('href', '')
        # Check for base64 or other obfuscation
        if 'javascript:' in href and '@' in href:
            matches = re.findall(config.EMAIL_PATTERNS[0], href, re.IGNORECASE)
            for match in matches:
                emails.add(match.lower())

    # Validate emails
    valid_emails = []
    for email in emails:
        try:
            # Basic validation
            validate_email(email, check_deliverability=False)
            # Filter out common false positives
            if not any(x in email for x in ['example.', 'test.', 'domain.', '@sentry', 'wixpress']):
                valid_emails.append(email)
        except EmailNotValidError:
            pass

    return list(set(valid_emails))


def extract_phones(html: str, soup: BeautifulSoup = None, country: str = "DE") -> List[str]:
    """Extract phone numbers from HTML"""
    phones: Set[str] = set()

    if soup is None:
        soup = BeautifulSoup(html, 'lxml')

    # 1. From tel links
    for link in soup.select('a[href^="tel:"]'):
        href = link.get('href', '')
        phone = href.replace('tel:', '').strip()
        if phone:
            phones.add(phone)

    # 2. From data attributes
    for elem in soup.select('[data-phone], [data-tel], [data-telefon]'):
        phone = elem.get('data-phone') or elem.get('data-tel') or elem.get('data-telefon')
        if phone:
            phones.add(phone)

    # 3. From text content using regex
    text = soup.get_text()
    for pattern in config.PHONE_PATTERNS:
        matches = re.findall(pattern, text)
        for match in matches:
            phones.add(match)

    # 4. Look in specific elements
    for selector in config.CONTACT_SELECTORS['phone']:
        for elem in soup.select(selector):
            text = clean_text(elem.get_text())
            for pattern in config.PHONE_PATTERNS:
                matches = re.findall(pattern, text)
                for match in matches:
                    phones.add(match)

    # Validate and format phones
    valid_phones = []
    for phone in phones:
        try:
            # Clean the phone number
            cleaned = re.sub(r'[^\d+]', '', phone)
            if len(cleaned) < 6:
                continue

            # Try to parse with phonenumbers library
            try:
                parsed = phonenumbers.parse(phone, country)
                if phonenumbers.is_valid_number(parsed):
                    formatted = phonenumbers.format_number(
                        parsed,
                        phonenumbers.PhoneNumberFormat.INTERNATIONAL
                    )
                    valid_phones.append(formatted)
                    continue
            except:
                pass

            # Fallback: basic formatting
            if cleaned.startswith('+') or cleaned.startswith('00') or len(cleaned) >= 10:
                valid_phones.append(phone.strip())

        except Exception:
            pass

    return list(set(valid_phones))


def extract_addresses(html: str, soup: BeautifulSoup = None) -> List[str]:
    """Extract postal addresses from HTML"""
    addresses: List[str] = []

    if soup is None:
        soup = BeautifulSoup(html, 'lxml')

    # 1. From schema.org markup
    for elem in soup.select('[itemtype*="PostalAddress"]'):
        parts = []
        street = elem.select_one('[itemprop="streetAddress"]')
        postal = elem.select_one('[itemprop="postalCode"]')
        city = elem.select_one('[itemprop="addressLocality"]')
        country = elem.select_one('[itemprop="addressCountry"]')

        if street:
            parts.append(clean_text(street.get_text()))
        if postal:
            parts.append(clean_text(postal.get_text()))
        if city:
            parts.append(clean_text(city.get_text()))
        if country:
            parts.append(clean_text(country.get_text()))

        if parts:
            addresses.append(", ".join(parts))

    # 2. From address elements
    for elem in soup.select('address'):
        text = clean_text(elem.get_text())
        if text and len(text) > 10:
            addresses.append(text)

    # 3. From elements with address-related classes
    for selector in config.CONTACT_SELECTORS['address']:
        for elem in soup.select(selector):
            text = clean_text(elem.get_text())
            # Basic validation - should contain numbers (street number or postal code)
            if text and len(text) > 10 and re.search(r'\d{4,5}', text):
                addresses.append(text)

    # Deduplicate while preserving order
    seen = set()
    unique_addresses = []
    for addr in addresses:
        normalized = addr.lower()
        if normalized not in seen:
            seen.add(normalized)
            unique_addresses.append(addr)

    return unique_addresses[:3]  # Return max 3 addresses


def extract_social_links(html: str, soup: BeautifulSoup = None) -> Dict[str, str]:
    """Extract social media links"""
    social: Dict[str, str] = {}

    if soup is None:
        soup = BeautifulSoup(html, 'lxml')

    social_platforms = {
        'linkedin': ['linkedin.com/company', 'linkedin.com/in'],
        'facebook': ['facebook.com'],
        'instagram': ['instagram.com'],
        'twitter': ['twitter.com', 'x.com'],
        'xing': ['xing.com'],
        'youtube': ['youtube.com'],
    }

    for link in soup.find_all('a', href=True):
        href = link['href'].lower()
        for platform, patterns in social_platforms.items():
            if platform not in social:
                for pattern in patterns:
                    if pattern in href:
                        social[platform] = link['href']
                        break

    return social


def extract_persons(html: str, soup: BeautifulSoup = None) -> List[Dict[str, str]]:
    """Extract person/contact names from HTML"""
    persons: List[Dict[str, str]] = []

    if soup is None:
        soup = BeautifulSoup(html, 'lxml')

    # 1. From schema.org Person markup
    for elem in soup.select('[itemtype*="Person"]'):
        person = {}
        name = elem.select_one('[itemprop="name"]')
        job = elem.select_one('[itemprop="jobTitle"]')
        email = elem.select_one('[itemprop="email"]')
        phone = elem.select_one('[itemprop="telephone"]')

        if name:
            person['name'] = clean_text(name.get_text())
        if job:
            person['position'] = clean_text(job.get_text())
        if email:
            person['email'] = clean_text(email.get_text())
        if phone:
            person['phone'] = clean_text(phone.get_text())

        if person.get('name'):
            persons.append(person)

    # 2. From team/staff sections
    team_keywords = ['geschäftsführer', 'inhaber', 'ceo', 'founder', 'gründer',
                     'ansprechpartner', 'contact', 'kontakt', 'team']

    for selector in config.CONTACT_SELECTORS['person']:
        for container in soup.select(selector):
            # Look for name patterns
            text = container.get_text()

            # Common name patterns in German business contexts
            name_patterns = [
                r'(?:Geschäftsführer|CEO|Inhaber|Gründer)[:\s]+([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)',
                r'([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)(?:\s*[-–]\s*(?:Geschäftsführer|CEO|Inhaber))',
            ]

            for pattern in name_patterns:
                matches = re.findall(pattern, text)
                for match in matches:
                    if match and len(match.split()) >= 2:
                        persons.append({'name': match.strip()})

    # Deduplicate
    seen = set()
    unique_persons = []
    for person in persons:
        name = person.get('name', '').lower()
        if name and name not in seen:
            seen.add(name)
            unique_persons.append(person)

    return unique_persons[:5]  # Return max 5 persons


def extract_all_contacts(html: str, base_url: str = "") -> Dict:
    """Extract all contact information from HTML"""
    soup = BeautifulSoup(html, 'lxml')

    return {
        'emails': extract_emails(html, soup),
        'phones': extract_phones(html, soup),
        'addresses': extract_addresses(html, soup),
        'social': extract_social_links(html, soup),
        'persons': extract_persons(html, soup),
    }
