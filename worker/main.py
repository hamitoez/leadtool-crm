"""
Main entry point for the scraping worker.
Orchestrates the complete extraction pipeline.
"""

import asyncio
import logging
import sys
from typing import Dict, Any, List
from datetime import datetime

from config import Config
from database import db
from queue_handler import QueueHandler
from pipeline.normalizer import normalize_url
from pipeline.fetcher import Fetcher
from pipeline.discoverer import Discoverer
from pipeline.validator import Validator
from extractors.email import EmailExtractor
from extractors.phone import PhoneExtractor
from extractors.person import PersonExtractor
from extractors.llm import LLMExtractor

# Configure logging
logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)

logger = logging.getLogger(__name__)


class ExtractionPipeline:
    """Main extraction pipeline orchestrator."""

    def __init__(self):
        """Initialize pipeline components."""
        self.fetcher = Fetcher()
        self.discoverer = Discoverer()
        self.validator = Validator()
        self.email_extractor = EmailExtractor()
        self.phone_extractor = PhoneExtractor()
        self.person_extractor = PersonExtractor()
        self.llm_extractor = LLMExtractor()

    async def process(self, job: Dict[str, Any]):
        """
        Process a single extraction job.

        Args:
            job: Job data with extractionId, url, rowId
        """
        extraction_id = job['extractionId']
        url = job['url']
        row_id = job['rowId']

        logger.info(f"Processing extraction {extraction_id} for URL: {url}")

        try:
            # Step 1: Normalize URL
            normalized_url = normalize_url(url)
            if not normalized_url:
                raise ValueError(f"Invalid URL: {url}")

            logger.info(f"Normalized URL: {normalized_url}")

            # Update extraction with normalized URL
            db.update_extraction_status(
                extraction_id=extraction_id,
                status="PROCESSING",
                progress=10,
            )

            # Step 2: Fetch homepage
            logger.info("Fetching homepage...")
            homepage_result = await self.fetcher.fetch(normalized_url)

            if not homepage_result.success:
                raise Exception(f"Failed to fetch homepage: {homepage_result.error}")

            # Save homepage
            db.save_scraped_page(
                extraction_id=extraction_id,
                url=normalized_url,
                page_type='homepage',
                html=homepage_result.html,
                text_content=self.discoverer.extract_text_content(homepage_result.html or ''),
                status_code=homepage_result.status_code,
                content_type=homepage_result.content_type,
                fetch_time=homepage_result.fetch_time_ms,
            )

            db.update_extraction_status(
                extraction_id=extraction_id,
                progress=30,
            )

            # Step 3: Discover relevant pages
            logger.info("Discovering relevant pages...")
            discovered_pages = self.discoverer.discover(
                base_url=normalized_url,
                html=homepage_result.html or '',
            )

            prioritized_pages = self.discoverer.prioritize_pages(discovered_pages)
            logger.info(f"Found {len(prioritized_pages)} relevant pages to fetch")

            # Step 4: Fetch all relevant pages
            logger.info("Fetching relevant pages...")
            page_results = {}
            for page_type, page_url in prioritized_pages:
                result = await self.fetcher.fetch(page_url)
                page_results[(page_type, page_url)] = result

                # Save scraped page
                if result.success:
                    db.save_scraped_page(
                        extraction_id=extraction_id,
                        url=page_url,
                        page_type=page_type,
                        html=result.html,
                        text_content=self.discoverer.extract_text_content(result.html or ''),
                        status_code=result.status_code,
                        content_type=result.content_type,
                        fetch_time=result.fetch_time_ms,
                    )

            db.update_extraction_status(
                extraction_id=extraction_id,
                progress=50,
            )

            # Step 5: Extract data from all pages
            logger.info("Extracting data from pages...")
            all_emails = []
            all_phones = []
            all_persons = []

            # Extract from homepage
            if homepage_result.html:
                homepage_text = self.discoverer.extract_text_content(homepage_result.html)
                all_emails.extend(
                    self.email_extractor.extract(homepage_result.html, homepage_text, 'homepage')
                )
                all_phones.extend(
                    self.phone_extractor.extract(homepage_text, 'homepage')
                )
                all_persons.extend(
                    self.person_extractor.extract(homepage_text, 'homepage')
                )

            # Extract from relevant pages
            for (page_type, page_url), result in page_results.items():
                if result.success and result.html:
                    text = self.discoverer.extract_text_content(result.html)
                    all_emails.extend(
                        self.email_extractor.extract(result.html, text, page_type)
                    )
                    all_phones.extend(
                        self.phone_extractor.extract(text, page_type)
                    )
                    all_persons.extend(
                        self.person_extractor.extract(text, page_type)
                    )

            logger.info(
                f"Rule-based extraction: {len(all_emails)} emails, "
                f"{len(all_phones)} phones, {len(all_persons)} persons"
            )

            db.update_extraction_status(
                extraction_id=extraction_id,
                progress=70,
            )

            # Step 6: Save extracted entities
            saved_entities = []

            # Save emails
            for email in all_emails:
                # Validate
                validation = self.validator.validate_email(
                    email.email, normalized_url, email.source
                )

                if validation['valid']:
                    entity_id = db.save_extracted_entity(
                        extraction_id=extraction_id,
                        entity_type='EMAIL',
                        value=email.email,
                        data={
                            'classification': email.classification,
                            'context': email.context,
                            'validation': validation,
                        },
                        confidence=validation['confidence'],
                        source=email.source,
                        method=email.method,
                        is_fallback=False,
                    )
                    if entity_id:
                        saved_entities.append({
                            'entity_type': 'EMAIL',
                            'confidence': validation['confidence'],
                        })

            # Save phones
            for phone in all_phones:
                # Validate
                validation = self.validator.validate_phone(phone.phone, phone.source)

                if validation['valid']:
                    entity_id = db.save_extracted_entity(
                        extraction_id=extraction_id,
                        entity_type='PHONE',
                        value=phone.phone,
                        data={
                            'raw': phone.raw,
                            'validation': validation,
                        },
                        confidence=validation['confidence'],
                        source=phone.source,
                        method=phone.method,
                        is_fallback=False,
                    )
                    if entity_id:
                        saved_entities.append({
                            'entity_type': 'PHONE',
                            'confidence': validation['confidence'],
                        })

            # Save persons
            for person in all_persons:
                # Validate
                validation = self.validator.validate_person(
                    person.first_name, person.last_name, person.role or '', person.source
                )

                if validation['valid']:
                    entity_id = db.save_extracted_entity(
                        extraction_id=extraction_id,
                        entity_type='PERSON',
                        value=person.full_name,
                        data={
                            'first_name': person.first_name,
                            'last_name': person.last_name,
                            'role': person.role,
                            'validation': validation,
                        },
                        confidence=validation['confidence'],
                        source=person.source,
                        method=person.method,
                        is_fallback=False,
                    )
                    if entity_id:
                        saved_entities.append({
                            'entity_type': 'PERSON',
                            'confidence': validation['confidence'],
                        })

            db.update_extraction_status(
                extraction_id=extraction_id,
                progress=80,
            )

            # Step 7: Calculate overall confidence
            overall_confidence = self.validator.calculate_overall_confidence(saved_entities)

            logger.info(f"Overall confidence: {overall_confidence}")

            # Step 8: LLM fallback if needed
            use_llm_fallback = (
                Config.ENABLE_LLM_FALLBACK and
                (
                    overall_confidence < Config.LLM_CONFIDENCE_THRESHOLD or
                    len(saved_entities) == 0
                )
            )

            if use_llm_fallback:
                logger.info("Using LLM fallback due to low confidence or no results")

                # Find best page for LLM extraction (prefer impressum)
                llm_text = None
                llm_source = None

                # Try impressum first
                for (page_type, page_url), result in page_results.items():
                    if page_type == 'impressum' and result.success and result.html:
                        llm_text = self.discoverer.extract_text_content(result.html)
                        llm_source = 'impressum'
                        break

                # Fallback to homepage if no impressum
                if not llm_text and homepage_result.html:
                    llm_text = self.discoverer.extract_text_content(homepage_result.html)
                    llm_source = 'homepage'

                if llm_text:
                    # Run LLM extraction
                    llm_result = self.llm_extractor.extract_from_impressum(
                        llm_text, normalized_url
                    )

                    # Convert and save LLM entities
                    if llm_result:
                        llm_entities = self.llm_extractor.convert_llm_to_entities(
                            llm_result, extraction_id, llm_source
                        )

                        for entity in llm_entities:
                            entity_id = db.save_extracted_entity(**entity)
                            if entity_id:
                                saved_entities.append({
                                    'entity_type': entity['entity_type'],
                                    'confidence': entity['confidence'],
                                })

                        # Recalculate overall confidence
                        overall_confidence = self.validator.calculate_overall_confidence(
                            saved_entities
                        )
                        logger.info(f"Overall confidence after LLM: {overall_confidence}")

            db.update_extraction_status(
                extraction_id=extraction_id,
                progress=90,
            )

            # Step 9: Determine final status
            if len(saved_entities) > 0:
                if overall_confidence >= 0.7:
                    final_status = 'COMPLETED'
                else:
                    final_status = 'PARTIAL'
            else:
                final_status = 'FAILED'

            # Step 10: Update extraction record
            db.update_extraction_status(
                extraction_id=extraction_id,
                status=final_status,
                progress=100,
                confidence=overall_confidence,
                raw_data={
                    'entity_count': len(saved_entities),
                    'email_count': len([e for e in saved_entities if e['entity_type'] == 'EMAIL']),
                    'phone_count': len([e for e in saved_entities if e['entity_type'] == 'PHONE']),
                    'person_count': len([e for e in saved_entities if e['entity_type'] == 'PERSON']),
                },
            )

            logger.info(
                f"Extraction {extraction_id} completed with status {final_status}. "
                f"Confidence: {overall_confidence}, Entities: {len(saved_entities)}"
            )

        except Exception as e:
            logger.error(f"Error processing extraction {extraction_id}: {e}", exc_info=True)
            raise


async def main():
    """Main entry point."""
    logger.info("Starting scraping worker...")
    logger.info(f"Configuration: {Config.REDIS_URL}, LLM: {Config.ENABLE_LLM_FALLBACK}")

    # Initialize pipeline
    pipeline = ExtractionPipeline()

    # Initialize queue handler
    queue_handler = QueueHandler()

    # Start fetcher
    await pipeline.fetcher.start()

    try:
        # Listen for jobs
        await queue_handler.listen(pipeline.process)
    finally:
        # Cleanup
        await pipeline.fetcher.close()
        db.close()
        logger.info("Worker shut down")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
