"""Pipeline modules for URL processing and data extraction."""

from .normalizer import normalize_url
from .fetcher import Fetcher, FetchResult
from .discoverer import Discoverer
from .validator import Validator
