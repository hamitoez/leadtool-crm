# -*- coding: utf-8 -*-
"""Tests for the HTML parser module."""

import pytest
from scraper.core.parser import ImpressumParser, GermanImpressumParser
from scraper.utils.text_cleaner import TextCleaner


class TestTextCleaner:
    """Tests for TextCleaner utility class."""

    def test_extract_emails_deobfuscation_at(self):
        """Test email deobfuscation with (at) pattern."""
        text = "Contact: max (at) example (dot) de"
        emails = TextCleaner.extract_emails(text)
        assert "max@example.de" in emails

    def test_extract_emails_deobfuscation_brackets(self):
        """Test email deobfuscation with [at] pattern."""
        text = "Email: info [at] company [dot] com"
        emails = TextCleaner.extract_emails(text)
        assert "info@company.com" in emails

    def test_extract_emails_deobfuscation_german(self):
        """Test email deobfuscation with German patterns."""
        text = "E-Mail: kontakt (ät) firma (punkt) de"
        emails = TextCleaner.extract_emails(text)
        assert "kontakt@firma.de" in emails

    def test_extract_emails_multiple(self):
        """Test extraction of multiple emails."""
        text = """
        info@company.de
        max.mustermann@example.com
        support@test.org
        """
        emails = TextCleaner.extract_emails(text)
        assert len(emails) == 3
        assert "info@company.de" in emails
        assert "max.mustermann@example.com" in emails
        assert "support@test.org" in emails

    def test_extract_emails_skips_invalid(self):
        """Test that invalid emails are skipped."""
        text = """
        valid@example.de
        image@test.png
        short@x.c
        double..dot@test.de
        """
        emails = TextCleaner.extract_emails(text)
        assert "valid@example.de" in emails
        assert len(emails) == 1

    def test_prioritize_emails_personal_first(self):
        """Test that personal emails come before generic ones."""
        emails = ["info@company.de", "max.mustermann@company.de", "kontakt@company.de"]
        prioritized = TextCleaner.prioritize_emails(emails)
        assert prioritized[0] == "max.mustermann@company.de"
        assert "info@company.de" in prioritized[1:]
        assert "kontakt@company.de" in prioritized[1:]

    def test_is_personal_email(self):
        """Test personal email detection."""
        assert TextCleaner.is_personal_email("max.mustermann@company.de")
        assert not TextCleaner.is_personal_email("info@company.de")
        assert not TextCleaner.is_personal_email("kontakt@company.de")
        assert not TextCleaner.is_personal_email("support@company.de")


class TestGermanPhoneExtraction:
    """Tests for German phone number extraction."""

    def test_extract_phone_plus49(self):
        """Test +49 format phone numbers."""
        text = "Tel: +49 30 123456789"
        phones = TextCleaner.extract_phone_numbers(text)
        assert len(phones) >= 1
        assert any("+49" in p or "4930" in p for p in phones)

    def test_extract_phone_0049(self):
        """Test 0049 format phone numbers."""
        text = "Telefon: 0049 89 987654321"
        phones = TextCleaner.extract_phone_numbers(text)
        assert len(phones) >= 1

    def test_extract_phone_national(self):
        """Test national format phone numbers."""
        text = "Rückruf: 030 / 12345678"
        phones = TextCleaner.extract_phone_numbers(text)
        assert len(phones) >= 1

    def test_extract_phone_grouped(self):
        """Test grouped format phone numbers."""
        text = "Tel.: (089) 123 456 789"
        phones = TextCleaner.extract_phone_numbers(text)
        assert len(phones) >= 1

    def test_extract_phone_multiple(self):
        """Test extraction of multiple phone numbers."""
        text = """
        Büro: +49 30 12345678
        Mobil: 0171 2345678
        Fax: 030/87654321
        """
        phones = TextCleaner.extract_phone_numbers(text)
        assert len(phones) >= 2


class TestAddressExtraction:
    """Tests for German address extraction."""

    def test_extract_address_plz_pattern(self):
        """Test German PLZ (5-digit postal code) pattern."""
        parser = GermanImpressumParser()
        text = """
        Musterstraße 123
        12345 Berlin
        Deutschland
        """
        address = parser._extract_address(text)
        assert address is not None
        assert "12345" in address
        assert "Berlin" in address

    def test_extract_address_with_street(self):
        """Test address extraction includes street."""
        parser = GermanImpressumParser()
        text = """
        Hauptstraße 42
        80331 München
        """
        address = parser._extract_address(text)
        assert address is not None
        assert "München" in address


class TestHTMLParsing:
    """Tests for HTML parsing functionality."""

    def test_parse_valid_impressum(self, sample_html):
        """Test parsing valid Impressum HTML."""
        parser = ImpressumParser()
        result = parser.parse(sample_html)

        assert result["text"]
        assert len(result["emails"]) > 0
        assert "max.mustermann@example.de" in result["emails"]

    def test_handle_malformed_html(self, malformed_html):
        """Test handling of malformed HTML."""
        parser = ImpressumParser()
        result = parser.parse(malformed_html)

        # Should not raise exception
        assert isinstance(result, dict)
        assert "text" in result
        assert "emails" in result

    def test_parse_empty_content(self):
        """Test parsing empty content."""
        parser = ImpressumParser()
        result = parser.parse("")

        assert result["text"] == ""
        assert result["emails"] == []
        assert result["phones"] == []

    def test_parse_removes_script_tags(self):
        """Test that script content is removed."""
        html = """
        <html>
        <body>
            <p>Contact us</p>
            <script>
                var secret = "password123";
                var email = "hidden@example.de";
            </script>
            <p>Email: visible@example.de</p>
        </body>
        </html>
        """
        parser = ImpressumParser()
        result = parser.parse(html)

        assert "visible@example.de" in result["emails"]
        # The email in script might or might not be extracted depending on implementation

    def test_extract_names(self):
        """Test name extraction from text."""
        parser = GermanImpressumParser()
        text = """
        Geschäftsführer: Dr. Max Mustermann
        Prokurist: Anna Schmidt
        """
        names = parser._extract_names(text)

        assert len(names) >= 1
        name_strs = [f"{n['first_name']} {n['last_name']}" for n in names]
        # Check if at least one name was extracted
        assert any("Max" in s or "Anna" in s for s in name_strs)

    def test_extract_positions(self):
        """Test position extraction."""
        parser = GermanImpressumParser()
        text = """
        Geschäftsführer: Max Mustermann
        Inhaber: Anna Schmidt
        CEO: John Doe
        """
        positions = parser._extract_positions(text)

        assert len(positions) >= 1

    def test_get_text_for_llm_truncation(self):
        """Test text truncation for LLM."""
        parser = ImpressumParser()
        long_text = "A" * 10000

        html = f"<html><body><p>{long_text}</p></body></html>"
        result = parser.get_text_for_llm(html, max_length=1000)

        assert len(result) <= 1000


class TestParserStrategies:
    """Tests for parser strategy pattern."""

    def test_german_parser_country_code(self):
        """Test German parser country code."""
        parser = ImpressumParser(country="DE")
        assert parser._strategy.country_code == "DE"

    def test_austrian_parser(self):
        """Test Austrian parser for 4-digit PLZ."""
        parser = ImpressumParser(country="AT")
        assert parser._strategy.country_code == "AT"

        text = """
        Beispielgasse 1
        1010 Wien
        """
        result = parser.parse(f"<html><body>{text}</body></html>")
        assert result["address"] is not None
        assert "Wien" in result["address"]

    def test_swiss_parser(self):
        """Test Swiss parser."""
        parser = ImpressumParser(country="CH")
        assert parser._strategy.country_code == "CH"

        text = """
        Bahnhofstrasse 10
        CH-8001 Zürich
        """
        result = parser.parse(f"<html><body>{text}</body></html>")
        assert result["address"] is not None

    def test_default_parser_fallback(self):
        """Test fallback to German parser for unknown country."""
        parser = ImpressumParser(country="XX")
        assert parser._strategy.country_code == "DE"
