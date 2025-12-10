"""Pydantic models for Impressum scraping."""

from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
import re


class ScrapeStatus(str, Enum):
    """Status of a scraping job."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ContactInfo(BaseModel):
    """Extracted contact information from Impressum."""

    first_name: Optional[str] = Field(None, description="Vorname")
    last_name: Optional[str] = Field(None, description="Nachname")
    email: Optional[str] = Field(None, description="E-Mail-Adresse")
    phone: Optional[str] = Field(None, description="Telefonnummer")
    position: Optional[str] = Field(None, description="Position/Titel")
    company: Optional[str] = Field(None, description="Firmenname")
    address: Optional[str] = Field(None, description="Adresse")

    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Konfidenz der Extraktion")

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().lower()
        # Basic email validation
        if re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            return v
        return None

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        # Remove all non-digit characters except + at start
        v = v.strip()
        if v.startswith("+"):
            return "+" + re.sub(r"[^\d]", "", v[1:])
        return re.sub(r"[^\d]", "", v)


class ScrapeResult(BaseModel):
    """Result of scraping a single URL."""

    url: str = Field(..., description="Die gescrapte URL")
    success: bool = Field(default=False, description="Ob das Scraping erfolgreich war")

    # Primary contact (best match)
    contact: Optional[ContactInfo] = Field(None, description="Hauptkontakt")

    # All found data (for fallback)
    all_emails: List[str] = Field(default_factory=list, description="Alle gefundenen E-Mails")
    all_phones: List[str] = Field(default_factory=list, description="Alle gefundenen Telefonnummern")

    # Metadata
    impressum_url: Optional[str] = Field(None, description="URL der Impressum-Seite")
    pages_checked: List[str] = Field(default_factory=list, description="Geprüfte Seiten")
    extraction_method: Optional[str] = Field(None, description="Verwendete Extraktionsmethode")

    # Error handling
    error: Optional[str] = Field(None, description="Fehlermeldung falls fehlgeschlagen")

    # Timing
    duration_ms: int = Field(default=0, description="Dauer in Millisekunden")

    def to_legacy_format(self) -> Dict[str, Any]:
        """Convert to legacy format for backwards compatibility."""
        return {
            "success": self.success,
            "url": self.url,
            "emails": self.all_emails,
            "phones": self.all_phones,
            "addresses": [self.contact.address] if self.contact and self.contact.address else [],
            "social": {},
            "persons": [
                {
                    "name": f"{self.contact.first_name or ''} {self.contact.last_name or ''}".strip() if self.contact else None,
                    "position": self.contact.position if self.contact else None,
                    "email": self.contact.email if self.contact else None,
                    "phone": self.contact.phone if self.contact else None,
                }
            ] if self.contact else [],
            "pages_scraped": self.pages_checked,
            "error": self.error,
            "firstName": self.contact.first_name if self.contact else None,
            "lastName": self.contact.last_name if self.contact else None,
        }


class ScrapeJob(BaseModel):
    """A bulk scraping job."""

    job_id: str = Field(..., description="Eindeutige Job-ID")
    status: ScrapeStatus = Field(default=ScrapeStatus.PENDING, description="Aktueller Status")

    total: int = Field(default=0, description="Gesamtanzahl URLs")
    completed: int = Field(default=0, description="Abgeschlossene URLs")
    failed: int = Field(default=0, description="Fehlgeschlagene URLs")

    results: List[ScrapeResult] = Field(default_factory=list, description="Ergebnisse")

    # Settings
    max_concurrent: int = Field(default=100, description="Max parallele Requests")

    @property
    def progress(self) -> float:
        """Calculate progress percentage."""
        if self.total == 0:
            return 0.0
        return round((self.completed / self.total) * 100, 1)


class BulkScrapeRequest(BaseModel):
    """Request for bulk scraping."""

    urls: List[str] = Field(..., min_length=1, description="Liste der URLs")
    max_concurrent: int = Field(default=100, ge=1, le=200, description="Max parallele Requests")

    # API Key from user settings
    api_key: Optional[str] = Field(None, description="OpenAI API Key")


class BulkScrapeResponse(BaseModel):
    """Response for bulk scraping job creation."""

    job_id: str = Field(..., description="Job-ID zum Abfragen des Status")
    status: ScrapeStatus = Field(default=ScrapeStatus.PENDING)
    total: int = Field(..., description="Gesamtanzahl URLs")
    message: str = Field(default="Job gestartet")
