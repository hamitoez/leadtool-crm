"""LLM-based contact information extractor using OpenAI GPT-4o."""

import asyncio
from typing import Optional, Dict, Any, List
from openai import AsyncOpenAI
import json
import logging

from ..models.impressum import ContactInfo
from ..utils.rate_limiter import RateLimiter
from ..prompts.impressum_prompt import IMPRESSUM_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)


class LLMExtractor:
    """
    LLM-based extractor for contact information.

    Uses OpenAI GPT-4o for high-accuracy extraction from German Impressum text.
    Includes rate limiting and batch processing support.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o",
        max_concurrent: int = 50,
        temperature: float = 0.0,
        max_tokens: int = 500,
    ):
        """
        Initialize the LLM extractor.

        Args:
            api_key: OpenAI API key
            model: Model to use (default: gpt-4o)
            max_concurrent: Maximum concurrent API calls
            temperature: LLM temperature (0.0 for deterministic)
            max_tokens: Maximum tokens in response
        """
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._rate_limiter = RateLimiter(max_concurrent=max_concurrent)

        # Stats
        self._total_calls = 0
        self._successful_calls = 0
        self._failed_calls = 0

    async def extract(
        self,
        text: str,
        fallback_emails: Optional[List[str]] = None,
        fallback_phones: Optional[List[str]] = None,
    ) -> Optional[ContactInfo]:
        """
        Extract contact information from text using LLM.

        Args:
            text: Cleaned text from Impressum page
            fallback_emails: Pre-extracted emails for fallback
            fallback_phones: Pre-extracted phones for fallback

        Returns:
            ContactInfo object or None if extraction failed
        """
        if not text or len(text.strip()) < 50:
            logger.debug("Text too short for LLM extraction")
            return self._create_fallback_contact(fallback_emails, fallback_phones)

        async with self._rate_limiter.acquire():
            self._total_calls += 1

            try:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {
                            "role": "system",
                            "content": IMPRESSUM_EXTRACTION_PROMPT,
                        },
                        {
                            "role": "user",
                            "content": f"Extrahiere die Kontaktdaten aus folgendem Impressum-Text:\n\n{text}",
                        },
                    ],
                    temperature=self._temperature,
                    max_tokens=self._max_tokens,
                    response_format={"type": "json_object"},
                )

                # Parse response
                content = response.choices[0].message.content
                if not content:
                    raise ValueError("Empty response from LLM")

                data = json.loads(content)
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

            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse LLM JSON response: {e}")
                self._failed_calls += 1
                return self._create_fallback_contact(fallback_emails, fallback_phones)

            except Exception as e:
                logger.error(f"LLM extraction failed: {e}")
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
    def stats(self) -> Dict[str, int]:
        """Get extraction statistics."""
        return {
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
        """Close the client."""
        await self._client.close()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
