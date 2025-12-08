"""
LLM-based extraction module using Anthropic Claude.
Used as fallback when rule-based extraction yields low confidence results.
"""

import json
import logging
from typing import Dict, List, Any, Optional
from anthropic import Anthropic

from config import Config

logger = logging.getLogger(__name__)


class LLMExtractor:
    """LLM-based data extraction using Claude."""

    def __init__(self):
        """Initialize LLM extractor."""
        self.client: Optional[Anthropic] = None
        self.total_cost = 0.0
        self.total_requests = 0

        if Config.ANTHROPIC_API_KEY:
            self.client = Anthropic(api_key=Config.ANTHROPIC_API_KEY)
        else:
            logger.warning("ANTHROPIC_API_KEY not set, LLM extraction disabled")

    def extract_from_impressum(
        self, text: str, url: str
    ) -> Dict[str, Any]:
        """
        Extract structured data from impressum page using LLM.

        Args:
            text: Impressum page text content
            url: Company URL for context

        Returns:
            Dict with extracted entities
        """
        if not self.client:
            logger.error("LLM client not initialized")
            return {}

        try:
            # Prepare prompt
            prompt = self._build_impressum_prompt(text, url)

            # Make API call
            response = self.client.messages.create(
                model=Config.ANTHROPIC_MODEL,
                max_tokens=Config.ANTHROPIC_MAX_TOKENS,
                temperature=0,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Track usage
            self.total_requests += 1
            self._track_cost(response.usage)

            # Parse response
            content = response.content[0].text
            result = self._parse_llm_response(content)

            logger.info(
                f"LLM extraction completed. Tokens: {response.usage.input_tokens}+{response.usage.output_tokens}"
            )

            return result

        except Exception as e:
            logger.error(f"LLM extraction failed: {e}", exc_info=True)
            return {}

    def _build_impressum_prompt(self, text: str, url: str) -> str:
        """
        Build prompt for impressum extraction.

        Args:
            text: Impressum text
            url: Company URL

        Returns:
            Prompt string
        """
        # Truncate text if too long (to save tokens)
        max_length = 3000
        if len(text) > max_length:
            text = text[:max_length] + "..."

        prompt = f"""Extract contact information from this German impressum/imprint page.

Company URL: {url}

Impressum text:
{text}

Please extract the following information and return it as a JSON object:

{{
  "emails": [
    {{
      "email": "example@company.com",
      "type": "business|role|personal",
      "confidence": 0.9
    }}
  ],
  "phones": [
    {{
      "phone": "+49 123 456789",
      "type": "main|fax|mobile",
      "confidence": 0.9
    }}
  ],
  "persons": [
    {{
      "first_name": "Max",
      "last_name": "Mustermann",
      "role": "Geschäftsführer",
      "confidence": 0.9
    }}
  ],
  "company_name": "Example GmbH",
  "address": {{
    "street": "Musterstraße 123",
    "zip": "12345",
    "city": "Berlin",
    "country": "Deutschland"
  }},
  "trade_register": "HRB 12345",
  "vat_id": "DE123456789"
}}

Rules:
- Only extract information that is clearly stated
- For emails: prefer business emails over personal (gmail, etc.)
- For phones: normalize to +49 format
- For persons: only extract if role is mentioned (Geschäftsführer, Inhaber, etc.)
- Set confidence to 0.9 for clearly stated info, 0.7 for inferred, 0.5 for uncertain
- Return valid JSON only, no additional text

JSON:"""

        return prompt

    def _parse_llm_response(self, content: str) -> Dict[str, Any]:
        """
        Parse LLM response JSON.

        Args:
            content: Response content

        Returns:
            Parsed data dict
        """
        try:
            # Try to find JSON in response
            # Sometimes Claude adds text before/after JSON
            json_match = content.strip()

            # Remove markdown code blocks if present
            if json_match.startswith('```'):
                lines = json_match.split('\n')
                json_match = '\n'.join(lines[1:-1]) if len(lines) > 2 else json_match

            # Parse JSON
            data = json.loads(json_match)

            # Validate structure
            if not isinstance(data, dict):
                logger.error("LLM response is not a dict")
                return {}

            return data

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Response content: {content}")
            return {}

    def _track_cost(self, usage):
        """
        Track API usage cost.

        Rough pricing (as of Jan 2024):
        - Claude 3.5 Sonnet: $3/MTok input, $15/MTok output

        Args:
            usage: Usage object from API response
        """
        input_tokens = usage.input_tokens
        output_tokens = usage.output_tokens

        # Rough cost calculation (in USD)
        input_cost = (input_tokens / 1_000_000) * 3
        output_cost = (output_tokens / 1_000_000) * 15

        total_cost = input_cost + output_cost
        self.total_cost += total_cost

        logger.debug(
            f"API call cost: ${total_cost:.4f} "
            f"(input: {input_tokens}, output: {output_tokens})"
        )

    def convert_llm_to_entities(
        self, llm_data: Dict[str, Any], extraction_id: str, source: str = "llm"
    ) -> List[Dict[str, Any]]:
        """
        Convert LLM extraction results to entity format.

        Args:
            llm_data: LLM extraction result
            extraction_id: Extraction ID
            source: Source identifier

        Returns:
            List of entity dicts ready for database insertion
        """
        entities = []

        # Extract emails
        for email_obj in llm_data.get('emails', []):
            entities.append({
                'extraction_id': extraction_id,
                'entity_type': 'EMAIL',
                'value': email_obj.get('email', ''),
                'data': {
                    'type': email_obj.get('type', 'business'),
                },
                'confidence': email_obj.get('confidence', 0.7),
                'source': source,
                'method': 'llm',
                'is_fallback': True,
            })

        # Extract phones
        for phone_obj in llm_data.get('phones', []):
            entities.append({
                'extraction_id': extraction_id,
                'entity_type': 'PHONE',
                'value': phone_obj.get('phone', ''),
                'data': {
                    'type': phone_obj.get('type', 'main'),
                },
                'confidence': phone_obj.get('confidence', 0.7),
                'source': source,
                'method': 'llm',
                'is_fallback': True,
            })

        # Extract persons
        for person_obj in llm_data.get('persons', []):
            full_name = f"{person_obj.get('first_name', '')} {person_obj.get('last_name', '')}".strip()
            if full_name:
                entities.append({
                    'extraction_id': extraction_id,
                    'entity_type': 'PERSON',
                    'value': full_name,
                    'data': {
                        'first_name': person_obj.get('first_name', ''),
                        'last_name': person_obj.get('last_name', ''),
                        'role': person_obj.get('role', ''),
                    },
                    'confidence': person_obj.get('confidence', 0.7),
                    'source': source,
                    'method': 'llm',
                    'is_fallback': True,
                })

        # Extract company name
        if llm_data.get('company_name'):
            entities.append({
                'extraction_id': extraction_id,
                'entity_type': 'COMPANY_NAME',
                'value': llm_data['company_name'],
                'data': {},
                'confidence': 0.8,
                'source': source,
                'method': 'llm',
                'is_fallback': True,
            })

        # Extract address
        if llm_data.get('address'):
            address = llm_data['address']
            address_str = f"{address.get('street', '')}, {address.get('zip', '')} {address.get('city', '')}"
            entities.append({
                'extraction_id': extraction_id,
                'entity_type': 'ADDRESS',
                'value': address_str,
                'data': address,
                'confidence': 0.8,
                'source': source,
                'method': 'llm',
                'is_fallback': True,
            })

        # Extract trade register
        if llm_data.get('trade_register'):
            entities.append({
                'extraction_id': extraction_id,
                'entity_type': 'TRADE_REGISTER',
                'value': llm_data['trade_register'],
                'data': {},
                'confidence': 0.9,
                'source': source,
                'method': 'llm',
                'is_fallback': True,
            })

        # Extract VAT ID
        if llm_data.get('vat_id'):
            entities.append({
                'extraction_id': extraction_id,
                'entity_type': 'VAT_ID',
                'value': llm_data['vat_id'],
                'data': {},
                'confidence': 0.9,
                'source': source,
                'method': 'llm',
                'is_fallback': True,
            })

        logger.info(f"Converted LLM data to {len(entities)} entities")
        return entities

    def get_stats(self) -> Dict[str, Any]:
        """
        Get usage statistics.

        Returns:
            Dict with usage stats
        """
        return {
            'total_requests': self.total_requests,
            'total_cost_usd': round(self.total_cost, 4),
        }
