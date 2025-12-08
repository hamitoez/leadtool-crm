"""
Regex patterns for data extraction.
Comprehensive patterns for emails, phone numbers, names, and other entities.
"""

import re

# ====================
# EMAIL PATTERNS
# ====================

# Standard email pattern (RFC 5322 simplified)
EMAIL_PATTERN = re.compile(
    r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b',
    re.IGNORECASE
)

# Obfuscated email patterns
EMAIL_OBFUSCATION_PATTERNS = [
    # [at], (at), {at}, <at>
    (re.compile(r'\b([a-zA-Z0-9._%+-]+)\s*[\[\(\{<]at[\]\)\}>]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b', re.IGNORECASE), r'\1@\2'),
    # [dot], (dot), {dot}, <dot>
    (re.compile(r'@([a-zA-Z0-9.-]*)\s*[\[\(\{<]dot[\]\)\}>]\s*([a-zA-Z]{2,})\b', re.IGNORECASE), r'@\1.\2'),
    # HTML entities: &#64; for @, &#46; for .
    (re.compile(r'([a-zA-Z0-9._%+-]+)&#64;([a-zA-Z0-9.-]+)&#46;([a-zA-Z]{2,})', re.IGNORECASE), r'\1@\2.\3'),
    # Spaces around @
    (re.compile(r'\b([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b', re.IGNORECASE), r'\1@\2'),
]

# Email domain blacklist (exclude these)
EMAIL_DOMAIN_BLACKLIST = {
    'example.com',
    'test.com',
    'localhost',
    'domain.com',
    'email.com',
    'sentry.io',  # Error tracking
    'google.com',
    'facebook.com',
    'twitter.com',
    'linkedin.com',
}

# Role-based email patterns
ROLE_BASED_EMAILS = {
    'info', 'contact', 'hello', 'support', 'admin', 'office',
    'sales', 'marketing', 'service', 'help', 'team', 'mail',
    'general', 'enquiry', 'inquiry', 'kontakt', 'post',
}

# Personal email providers
PERSONAL_EMAIL_PROVIDERS = {
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.de',
    'hotmail.com', 'hotmail.de', 'outlook.com', 'live.com',
    'web.de', 'gmx.de', 'gmx.net', 't-online.de', 'freenet.de',
    'aol.com', 'icloud.com', 'me.com',
}


# ====================
# PHONE PATTERNS
# ====================

# German phone number patterns
PHONE_PATTERNS = [
    # +49 formats
    re.compile(r'\+49\s*\(?\d{1,5}\)?\s*[\d\s\-/]{4,15}', re.IGNORECASE),
    # 0049 formats
    re.compile(r'0049\s*\(?\d{1,5}\)?\s*[\d\s\-/]{4,15}', re.IGNORECASE),
    # National format starting with 0
    re.compile(r'\b0\d{1,5}\s*[\d\s\-/]{4,15}\b', re.IGNORECASE),
    # Tel: or Phone: prefix
    re.compile(r'(?:tel|phone|telefon|fon)[\s:\.]*(\+?49|0)[\s\(]?\d{1,5}[\)\s]*[\d\s\-/]{4,15}', re.IGNORECASE),
]

# Phone number cleanup patterns
PHONE_CLEANUP_PATTERNS = [
    (re.compile(r'[\s\-\./\(\)]'), ''),  # Remove separators
    (re.compile(r'^0049'), '+49'),  # Normalize 0049 to +49
    (re.compile(r'^0'), '+49'),  # Normalize leading 0 to +49
]


# ====================
# PERSON/NAME PATTERNS
# ====================

# German name prefixes and titles
NAME_TITLES = {
    'dr', 'prof', 'dipl', 'ing', 'med', 'dr.', 'prof.', 'dipl.-ing.',
    'herr', 'frau', 'mr', 'mrs', 'ms', 'mr.', 'mrs.', 'ms.',
}

# German first names (common ones for validation)
GERMAN_FIRST_NAMES = {
    'alexander', 'andreas', 'anna', 'benjamin', 'christian', 'daniel',
    'david', 'dominik', 'elias', 'emily', 'emma', 'fabian', 'felix',
    'florian', 'hannah', 'jan', 'jonas', 'julia', 'laura', 'lea',
    'leon', 'lena', 'lisa', 'lukas', 'maria', 'markus', 'martin',
    'max', 'maximilian', 'michael', 'niklas', 'paul', 'peter',
    'philipp', 'sarah', 'sebastian', 'simon', 'sophie', 'stefan',
    'thomas', 'tim', 'tobias', 'tom',
}

# Role extraction patterns (German)
ROLE_PATTERNS = [
    (re.compile(r'(?:geschäftsführer|geschäftsfuhrer|ceo|managing director)[\s:]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)', re.IGNORECASE), 'Geschäftsführer'),
    (re.compile(r'(?:inhaber|owner)[\s:]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)', re.IGNORECASE), 'Inhaber'),
    (re.compile(r'(?:geschäftsführerin|ceo|managing director)[\s:]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)', re.IGNORECASE), 'Geschäftsführerin'),
    (re.compile(r'(?:vorstand|board member|director)[\s:]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)', re.IGNORECASE), 'Vorstand'),
    (re.compile(r'(?:ansprechpartner|contact person)[\s:]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)', re.IGNORECASE), 'Ansprechpartner'),
]

# Name pattern (German names with umlauts)
NAME_PATTERN = re.compile(
    r'\b([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3})\b'
)


# ====================
# URL PATTERNS
# ====================

# Link extraction pattern
LINK_PATTERN = re.compile(
    r'href=["\']((?:https?://|/)[^"\']+)["\']',
    re.IGNORECASE
)

# Absolute URL pattern
ABSOLUTE_URL_PATTERN = re.compile(
    r'^https?://',
    re.IGNORECASE
)


# ====================
# ADDRESS PATTERNS
# ====================

# German address patterns
STREET_PATTERN = re.compile(
    r'\b([A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|str\.?|weg|platz|allee|gasse))\s+(\d+[a-z]?)\b',
    re.IGNORECASE
)

ZIP_CITY_PATTERN = re.compile(
    r'\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b'
)


# ====================
# COMPANY PATTERNS
# ====================

# Legal entity suffixes (German)
LEGAL_ENTITY_SUFFIXES = {
    'GmbH', 'AG', 'KG', 'OHG', 'GmbH & Co. KG', 'UG',
    'e.V.', 'e.K.', 'GbR', 'PartG', 'SE',
}

LEGAL_ENTITY_PATTERN = re.compile(
    r'\b([A-ZÄÖÜ][a-zäöüß\s&]+(?:GmbH|AG|KG|OHG|UG|e\.V\.|e\.K\.|GbR|PartG|SE))\b'
)


# ====================
# TRADE REGISTER PATTERNS
# ====================

# Handelsregister (HRB, HRA, etc.)
TRADE_REGISTER_PATTERN = re.compile(
    r'\b(HR[AB]\s*\d+)\b',
    re.IGNORECASE
)


# ====================
# VAT ID PATTERNS
# ====================

# Umsatzsteuer-ID (DE + 9 digits)
VAT_ID_PATTERN = re.compile(
    r'\b(DE\s*\d{9})\b',
    re.IGNORECASE
)


# ====================
# HELPER FUNCTIONS
# ====================

def clean_phone_number(phone: str) -> str:
    """
    Clean and normalize phone number to +49 format.

    Args:
        phone: Raw phone number string

    Returns:
        Cleaned phone number
    """
    cleaned = phone
    for pattern, replacement in PHONE_CLEANUP_PATTERNS:
        cleaned = pattern.sub(replacement, cleaned)
    return cleaned


def is_valid_email_domain(email: str) -> bool:
    """
    Check if email domain is valid (not in blacklist).

    Args:
        email: Email address

    Returns:
        True if domain is valid
    """
    domain = email.split('@')[-1].lower()
    return domain not in EMAIL_DOMAIN_BLACKLIST


def is_role_based_email(email: str) -> bool:
    """
    Check if email is role-based (info@, contact@, etc.).

    Args:
        email: Email address

    Returns:
        True if role-based
    """
    local_part = email.split('@')[0].lower()
    return local_part in ROLE_BASED_EMAILS


def is_personal_email(email: str) -> bool:
    """
    Check if email is from a personal provider (Gmail, Yahoo, etc.).

    Args:
        email: Email address

    Returns:
        True if personal email provider
    """
    domain = email.split('@')[-1].lower()
    return domain in PERSONAL_EMAIL_PROVIDERS


def classify_email(email: str) -> str:
    """
    Classify email as personal, role-based, or business.

    Args:
        email: Email address

    Returns:
        Classification: "personal", "role", or "business"
    """
    if is_personal_email(email):
        return "personal"
    elif is_role_based_email(email):
        return "role"
    else:
        return "business"
