# -*- coding: utf-8 -*-
"""Multi-provider LLM-based contact information extractor.

This module provides an abstracted interface for LLM extraction,
supporting multiple providers: OpenAI, Anthropic Claude, and local Ollama.
Features automatic retry with exponential backoff for API errors.
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, Type, Tuple, TYPE_CHECKING
import json
import structlog

from pydantic import BaseModel

from ..models.impressum import ContactInfo
from ..utils.rate_limiter import RateLimiter
from ..utils.retry import retry_with_backoff
from ..prompts.impressum_prompt import IMPRESSUM_EXTRACTION_PROMPT

if TYPE_CHECKING:
    from ..config import ScraperConfig

logger = structlog.get_logger(__name__)

# Import exception types for retry logic
try:
    from openai import RateLimitError as OpenAIRateLimitError
    from openai import APITimeoutError as OpenAITimeoutError
    from openai import APIConnectionError as OpenAIConnectionError
    OPENAI_RETRY_EXCEPTIONS: Tuple[Type[Exception], ...] = (
        OpenAIRateLimitError, OpenAITimeoutError, OpenAIConnectionError
    )
except ImportError:
    OPENAI_RETRY_EXCEPTIONS = (Exception,)

try:
    from anthropic import RateLimitError as AnthropicRateLimitError
    from anthropic import APITimeoutError as AnthropicTimeoutError
    from anthropic import APIConnectionError as AnthropicConnectionError
    ANTHROPIC_RETRY_EXCEPTIONS: Tuple[Type[Exception], ...] = (
        AnthropicRateLimitError, AnthropicTimeoutError, AnthropicConnectionError
    )
except ImportError:
    ANTHROPIC_RETRY_EXCEPTIONS = (Exception,)

import aiohttp
OLLAMA_RETRY_EXCEPTIONS: Tuple[Type[Exception], ...] = (
    aiohttp.ClientError, asyncio.TimeoutError
)


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.

    All LLM providers must implement this interface to ensure
    consistent behavior across different backends.
    """

    @abstractmethod
    async def extract(
        self,
        text: str,
        schema: Type[BaseModel],
    ) -> Optional[Dict[str, Any]]:
        """
        Extract structured data from text using the LLM.

        Args:
            text: Input text to process
            schema: Pydantic model defining expected output structure

        Returns:
            Extracted data as dictionary, or None if extraction failed
        """
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close the provider and release resources."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name for logging."""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI GPT-4o provider implementation with retry logic."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o",
        temperature: float = 0.0,
        max_tokens: int = 500,
        max_concurrent: int = 50,
    ):
        """
        Initialize OpenAI provider.

        Args:
            api_key: OpenAI API key
            model: Model identifier (default: gpt-4o)
            temperature: Sampling temperature
            max_tokens: Maximum response tokens
            max_concurrent: Maximum concurrent API calls
        """
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._rate_limiter = RateLimiter(max_concurrent=max_concurrent)
        self._log = logger.bind(provider="openai", model=model)

    async def _call_api_with_retry(self, messages: List[Dict[str, str]]) -> Optional[str]:
        """
        Call OpenAI API with automatic retry on rate limit/timeout errors.

        Separated from extract() so only the API call is retried,
        not the entire processing logic.
        """
        @retry_with_backoff(
            max_retries=3,
            base_delay=1.0,
            max_delay=30.0,
            exponential_base=2.0,
            exceptions=OPENAI_RETRY_EXCEPTIONS,
        )
        async def _call():
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content

        return await _call()

    async def extract(
        self,
        text: str,
        schema: Type[BaseModel],
    ) -> Optional[Dict[str, Any]]:
        """Extract data using OpenAI GPT-4o with automatic retry."""
        async with self._rate_limiter.acquire():
            try:
                messages = [
                    {
                        "role": "system",
                        "content": IMPRESSUM_EXTRACTION_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": f"Extrahiere die Kontaktdaten aus folgendem Impressum-Text:\n\n{text}",
                    },
                ]

                content = await self._call_api_with_retry(messages)
                if not content:
                    return None

                return json.loads(content)

            except json.JSONDecodeError as e:
                self._log.warning("json_parse_error", error=str(e))
                return None
            except OPENAI_RETRY_EXCEPTIONS as e:
                # All retries exhausted
                self._log.error("api_failed_after_retries", error=str(e))
                return None
            except Exception as e:
                self._log.error("extraction_error", error=str(e))
                return None

    async def close(self) -> None:
        """Close the OpenAI client."""
        await self._client.close()

    @property
    def provider_name(self) -> str:
        return "openai"


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider implementation with retry logic."""

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-20250514",
        temperature: float = 0.0,
        max_tokens: int = 500,
        max_concurrent: int = 50,
    ):
        """
        Initialize Anthropic provider.

        Args:
            api_key: Anthropic API key
            model: Model identifier (default: claude-sonnet-4-20250514)
            temperature: Sampling temperature
            max_tokens: Maximum response tokens
            max_concurrent: Maximum concurrent API calls
        """
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._rate_limiter = RateLimiter(max_concurrent=max_concurrent)
        self._log = logger.bind(provider="anthropic", model=model)

    async def _call_api_with_retry(self, user_content: str) -> Optional[str]:
        """
        Call Anthropic API with automatic retry on rate limit/timeout errors.
        """
        @retry_with_backoff(
            max_retries=3,
            base_delay=1.0,
            max_delay=30.0,
            exponential_base=2.0,
            exceptions=ANTHROPIC_RETRY_EXCEPTIONS,
        )
        async def _call():
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,
                system=IMPRESSUM_EXTRACTION_PROMPT + "\n\nAntworte immer mit validem JSON.",
                messages=[
                    {
                        "role": "user",
                        "content": user_content,
                    },
                ],
            )
            return response.content[0].text if response.content else None

        return await _call()

    async def extract(
        self,
        text: str,
        schema: Type[BaseModel],
    ) -> Optional[Dict[str, Any]]:
        """Extract data using Anthropic Claude with automatic retry."""
        async with self._rate_limiter.acquire():
            try:
                user_content = f"Extrahiere die Kontaktdaten aus folgendem Impressum-Text:\n\n{text}"
                content = await self._call_api_with_retry(user_content)

                if not content:
                    return None

                # Try to extract JSON from response
                # Claude might wrap JSON in markdown code blocks
                if "```json" in content:
                    start = content.find("```json") + 7
                    end = content.find("```", start)
                    content = content[start:end].strip()
                elif "```" in content:
                    start = content.find("```") + 3
                    end = content.find("```", start)
                    content = content[start:end].strip()

                return json.loads(content)

            except json.JSONDecodeError as e:
                self._log.warning("json_parse_error", error=str(e))
                return None
            except ANTHROPIC_RETRY_EXCEPTIONS as e:
                # All retries exhausted
                self._log.error("api_failed_after_retries", error=str(e))
                return None
            except Exception as e:
                self._log.error("extraction_error", error=str(e))
                return None

    async def close(self) -> None:
        """Close the Anthropic client."""
        await self._client.close()

    @property
    def provider_name(self) -> str:
        return "anthropic"


class OllamaProvider(LLMProvider):
    """Local Ollama provider implementation with retry logic."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2",
        temperature: float = 0.0,
        max_tokens: int = 500,
        max_concurrent: int = 10,
    ):
        """
        Initialize Ollama provider.

        Args:
            base_url: Ollama server URL
            model: Model identifier (default: llama3.2)
            temperature: Sampling temperature
            max_tokens: Maximum response tokens
            max_concurrent: Maximum concurrent requests
        """
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._rate_limiter = RateLimiter(max_concurrent=max_concurrent)
        self._session: Optional[aiohttp.ClientSession] = None
        self._log = logger.bind(provider="ollama", model=model)

    async def _get_session(self):
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def _call_api_with_retry(self, prompt: str) -> Optional[str]:
        """
        Call Ollama API with automatic retry on connection/timeout errors.
        """
        @retry_with_backoff(
            max_retries=3,
            base_delay=1.0,
            max_delay=30.0,
            exponential_base=2.0,
            exceptions=OLLAMA_RETRY_EXCEPTIONS,
        )
        async def _call():
            session = await self._get_session()
            async with session.post(
                f"{self._base_url}/api/generate",
                json={
                    "model": self._model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": self._temperature,
                        "num_predict": self._max_tokens,
                    },
                },
            ) as response:
                if response.status != 200:
                    self._log.error("ollama_error", status=response.status)
                    return None
                data = await response.json()
                return data.get("response", "")

        return await _call()

    async def extract(
        self,
        text: str,
        schema: Type[BaseModel],
    ) -> Optional[Dict[str, Any]]:
        """Extract data using local Ollama with automatic retry."""
        async with self._rate_limiter.acquire():
            try:
                prompt = f"""{IMPRESSUM_EXTRACTION_PROMPT}

Extrahiere die Kontaktdaten aus folgendem Impressum-Text und antworte NUR mit validem JSON:

{text}

JSON:"""

                content = await self._call_api_with_retry(prompt)

                if not content:
                    return None

                # Clean up response - Ollama might include extra text
                content = content.strip()
                if content.startswith("```"):
                    lines = content.split("\n")
                    content = "\n".join(lines[1:-1])

                # Find JSON object
                start = content.find("{")
                end = content.rfind("}") + 1
                if start >= 0 and end > start:
                    content = content[start:end]

                return json.loads(content)

            except json.JSONDecodeError as e:
                self._log.warning("json_parse_error", error=str(e))
                return None
            except OLLAMA_RETRY_EXCEPTIONS as e:
                # All retries exhausted
                self._log.error("api_failed_after_retries", error=str(e))
                return None
            except Exception as e:
                self._log.error("extraction_error", error=str(e))
                return None

    async def close(self) -> None:
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()

    @property
    def provider_name(self) -> str:
        return "ollama"


class LLMExtractor:
    """
    High-level LLM extractor with multi-provider support.

    This class provides a unified interface for contact extraction
    using different LLM backends. It handles provider selection,
    fallback logic, and result normalization.

    Example:
        extractor = LLMExtractor.create(config)
        contact = await extractor.extract(text)
        await extractor.close()
    """

    def __init__(self, provider: LLMProvider):
        """
        Initialize extractor with a provider.

        Args:
            provider: LLM provider instance
        """
        self._provider = provider
        self._total_calls = 0
        self._successful_calls = 0
        self._failed_calls = 0
        self._log = logger.bind(provider=provider.provider_name)

    @classmethod
    def create(cls, config: "ScraperConfig") -> "LLMExtractor":
        """
        Create an extractor from configuration.

        Factory method that instantiates the appropriate provider
        based on configuration settings.

        Args:
            config: Scraper configuration

        Returns:
            Configured LLMExtractor instance
        """
        if config.llm_provider == "anthropic":
            provider = AnthropicProvider(
                api_key=config.anthropic_api_key,
                model=config.model if "claude" in config.model else "claude-sonnet-4-20250514",
                temperature=config.llm_temperature,
                max_tokens=config.llm_max_tokens,
                max_concurrent=config.llm_concurrency,
            )
        elif config.llm_provider == "ollama":
            provider = OllamaProvider(
                base_url=config.ollama_base_url,
                model=config.model if config.model not in ("gpt-4o", "gpt-4", "gpt-3.5-turbo") else "llama3.2",
                temperature=config.llm_temperature,
                max_tokens=config.llm_max_tokens,
                max_concurrent=min(config.llm_concurrency, 10),  # Ollama has lower throughput
            )
        else:
            # Default to OpenAI
            provider = OpenAIProvider(
                api_key=config.openai_api_key,
                model=config.model,
                temperature=config.llm_temperature,
                max_tokens=config.llm_max_tokens,
                max_concurrent=config.llm_concurrency,
            )

        return cls(provider)

    async def extract(
        self,
        text: str,
        fallback_emails: Optional[List[str]] = None,
        fallback_phones: Optional[List[str]] = None,
    ) -> Optional[ContactInfo]:
        """
        Extract contact information from text.

        Args:
            text: Cleaned text from Impressum page
            fallback_emails: Pre-extracted emails for fallback
            fallback_phones: Pre-extracted phones for fallback

        Returns:
            ContactInfo object or None if extraction failed
        """
        if not text or len(text.strip()) < 50:
            self._log.debug("text_too_short")
            return self._create_fallback_contact(fallback_emails, fallback_phones)

        self._total_calls += 1

        try:
            data = await self._provider.extract(text, ContactInfo)

            if not data:
                self._failed_calls += 1
                return self._create_fallback_contact(fallback_emails, fallback_phones)

            self._successful_calls += 1

            # Create ContactInfo from response
            contact = ContactInfo(
                first_name=data.get("first_name") or data.get("vorname"),
                last_name=data.get("last_name") or data.get("nachname"),
                email=data.get("email"),
                phone=data.get("phone") or data.get("telefon"),
                position=data.get("position") or data.get("titel"),
                company=data.get("company") or data.get("firma"),
                address=data.get("address") or data.get("adresse"),
                confidence=float(data.get("confidence", 0.8)),
            )

            # Use fallbacks if LLM didn't find email/phone
            if not contact.email and fallback_emails:
                contact.email = fallback_emails[0]
                contact.confidence = max(0.0, contact.confidence - 0.1)

            if not contact.phone and fallback_phones:
                contact.phone = fallback_phones[0]

            return contact

        except Exception as e:
            self._log.error("extraction_error", error=str(e))
            self._failed_calls += 1
            return self._create_fallback_contact(fallback_emails, fallback_phones)

    def _create_fallback_contact(
        self,
        emails: Optional[List[str]],
        phones: Optional[List[str]],
    ) -> Optional[ContactInfo]:
        """Create a fallback contact from regex-extracted data."""
        if not emails and not phones:
            return None

        return ContactInfo(
            email=emails[0] if emails else None,
            phone=phones[0] if phones else None,
            confidence=0.3,  # Low confidence for regex-only extraction
        )

    async def extract_batch(
        self,
        texts: List[Dict[str, Any]],
    ) -> List[Optional[ContactInfo]]:
        """
        Extract contact information from multiple texts concurrently.

        Args:
            texts: List of dicts with 'text', 'fallback_emails', 'fallback_phones'

        Returns:
            List of ContactInfo objects (or None for failed extractions)
        """
        tasks = [
            self.extract(
                item.get("text", ""),
                item.get("fallback_emails"),
                item.get("fallback_phones"),
            )
            for item in texts
        ]

        return await asyncio.gather(*tasks, return_exceptions=False)

    @property
    def stats(self) -> Dict[str, Any]:
        """Get extraction statistics."""
        return {
            "provider": self._provider.provider_name,
            "total_calls": self._total_calls,
            "successful_calls": self._successful_calls,
            "failed_calls": self._failed_calls,
            "success_rate": (
                round(self._successful_calls / self._total_calls * 100, 1)
                if self._total_calls > 0
                else 0.0
            ),
        }

    async def close(self) -> None:
        """Close the provider and release resources."""
        await self._provider.close()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
