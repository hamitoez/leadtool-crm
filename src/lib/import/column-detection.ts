import { ColumnType } from "@prisma/client";

/**
 * Intelligente Spaltentyp-Erkennung basierend auf Header-Namen UND Daten-Analyse
 * Priorisiert: 1) Inhalts-Analyse 2) Header-Keywords 3) Daten-Pattern-Matching
 *
 * WICHTIG: Diese Erkennung analysiert den INHALT der Spalten um zu verstehen
 * was wirklich drin steht, nicht nur den Header-Namen!
 */

// Email-Regex (RFC 5322 vereinfacht)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// URL-Regex
const URL_REGEX = /^(https?:\/\/|www\.)[a-zA-Z0-9][-a-zA-Z0-9@:%._+~#=]{0,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i;

// URLs die KEINE Business-Websites sind (Google Maps, Social Media Profile, etc.)
const NON_WEBSITE_URL_PATTERNS = [
  /google\.(com|de|at|ch)\/maps/i,           // Google Maps
  /maps\.google\./i,                          // maps.google.com
  /goo\.gl\/maps/i,                           // Google Maps Short Links
  /facebook\.com\//i,                         // Facebook
  /instagram\.com\//i,                        // Instagram
  /twitter\.com\//i,                          // Twitter
  /x\.com\//i,                                // X (Twitter)
  /linkedin\.com\//i,                         // LinkedIn
  /youtube\.com\//i,                          // YouTube
  /tiktok\.com\//i,                           // TikTok
  /yelp\.(com|de)\//i,                        // Yelp
  /tripadvisor\.(com|de)\//i,                 // TripAdvisor
  /booking\.com\//i,                          // Booking.com
];

/**
 * Prüft ob eine URL eine echte Business-Website ist (nicht Google Maps, Social Media, etc.)
 */
function isBusinessWebsiteUrl(url: string): boolean {
  const trimmed = url.trim();

  // Muss eine URL sein
  if (!URL_REGEX.test(trimmed) && !trimmed.startsWith("http") && !trimmed.startsWith("www.")) {
    return false;
  }

  // Prüfe gegen Non-Website Patterns
  for (const pattern of NON_WEBSITE_URL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  return true;
}

// Telefonnummer-Regex (strenger) - muss mit +, 0 oder ( beginnen und strukturiert sein
const PHONE_REGEX = /^(\+[\d\s\-]{8,20}|0[\d\s\-/]{6,20}|\(0[\d]+\)[\d\s\-/]{4,15})$/;

// Deutsches Telefon-Format
const GERMAN_PHONE_REGEX = /^(\+49|0049|0)[\d\s\-/()]{8,15}$/;

// Internationales Format
const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

// Datum-Patterns
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,                    // ISO: 2024-01-15
  /^\d{2}\.\d{2}\.\d{4}$/,                  // DE: 15.01.2024
  /^\d{2}\/\d{2}\/\d{4}$/,                  // US: 01/15/2024
  /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}$/i, // 15 Jan 2024
];

// Number-Pattern (inkl. Dezimalzahlen und negative Zahlen)
const NUMBER_REGEX = /^-?[\d\s,.]+$/;

// Header-Keywords für Typ-Erkennung (case-insensitive)
const HEADER_KEYWORDS: Record<ColumnType, string[]> = {
  [ColumnType.EMAIL]: ["email", "e-mail", "mail", "e_mail"],
  [ColumnType.PHONE]: ["phone", "telefon", "tel", "mobile", "mobil", "handy", "fax", "fon"],
  [ColumnType.URL]: ["url", "website", "webseite", "link", "homepage", "web"],
  [ColumnType.NUMBER]: ["nummer", "number", "anzahl", "count", "rating", "bewertung", "reviews", "preis", "price", "amount", "betrag", "menge", "quantity", "score"],
  [ColumnType.DATE]: ["date", "datum", "created", "updated", "erstellt", "geändert", "modified", "time", "zeit"],
  [ColumnType.COMPANY]: ["company", "firma", "unternehmen", "business", "organization", "organisation", "betrieb"],
  [ColumnType.PERSON]: ["person", "contact", "kontakt", "ansprechpartner", "owner"],
  [ColumnType.ADDRESS]: ["address", "adresse", "street", "straße", "strasse", "city", "stadt", "plz", "zip", "postcode", "location", "ort", "standort"],
  [ColumnType.STATUS]: ["status", "state", "zustand", "stage", "phase"],
  [ColumnType.SELECT]: ["type", "typ", "category", "kategorie", "art"],
  [ColumnType.MULTI_SELECT]: ["tags", "labels", "categories", "kategorien"],
  [ColumnType.CONFIDENCE]: ["confidence", "konfidenz", "certainty", "sicherheit", "wahrscheinlichkeit"],
  [ColumnType.TEXT]: [],
  [ColumnType.AI_GENERATED]: ["ai", "generated", "auto"],
};

// ============================================
// INTELLIGENTE INHALTS-ERKENNUNG
// ============================================

// Typische Firmenbezeichnungen (DE & EN)
const COMPANY_INDICATORS = [
  // Rechtsformen
  "gmbh", "ag", "kg", "ohg", "gbr", "ug", "e.v.", "ev", "e.k.", "ek",
  "ltd", "limited", "inc", "corp", "corporation", "llc", "plc", "co.",
  // Branchen-Begriffe
  "restaurant", "gasthaus", "gasthof", "pizzeria", "trattoria", "bistro", "café", "cafe",
  "hotel", "pension", "hostel",
  "praxis", "kanzlei", "büro", "studio", "agentur", "agency",
  "werkstatt", "service", "services", "shop", "store", "markt", "market",
  "salon", "spa", "fitness", "gym",
  "bäckerei", "bakery", "metzgerei", "apotheke", "pharmacy",
  "autohaus", "reisebüro", "immobilien",
  "bar", "pub", "club", "lounge",
  "center", "zentrum", "institut", "akademie",
  // Allgemeine Business-Begriffe
  "& co", "und partner", "group", "holding", "consulting",
  "solutions", "tech", "digital", "media", "design",
];

// Typische Vornamen (DE & international) - für Person-Erkennung
const COMMON_FIRST_NAMES = [
  // Deutsche Vornamen
  "thomas", "michael", "andreas", "stefan", "christian", "martin", "peter", "markus", "daniel", "alexander",
  "julia", "anna", "sarah", "lisa", "laura", "maria", "sandra", "claudia", "nicole", "kathrin",
  "max", "jan", "tim", "felix", "lukas", "jonas", "paul", "leon", "david", "tobias",
  "sophie", "emma", "lena", "hannah", "lea", "marie", "mia", "johanna", "amelie", "elena",
  // Internationale
  "john", "james", "robert", "david", "william", "richard", "joseph", "charles", "christopher", "matthew",
  "mary", "jennifer", "linda", "elizabeth", "barbara", "susan", "jessica", "sarah", "karen", "nancy",
  "mohammed", "ali", "ahmed", "omar", "hassan", "fatima", "aisha", "sara",
  // Türkische
  "mehmet", "mustafa", "ahmet", "ali", "hasan", "hüseyin", "ibrahim", "ismail", "osman", "yusuf",
  "fatma", "ayşe", "emine", "hatice", "zeynep", "elif", "sultan", "melek", "esra", "merve",
];

// Adress-Indikatoren
const ADDRESS_INDICATORS = [
  "str.", "straße", "strasse", "weg", "platz", "allee", "ring", "gasse",
  "street", "st.", "road", "rd.", "avenue", "ave.", "boulevard", "blvd.",
  "lane", "drive", "dr.", "court", "ct.", "place", "pl.",
];

// PLZ-Pattern (verschiedene Länder)
const PLZ_PATTERNS = [
  /^\d{5}$/, // DE
  /^\d{4}$/, // AT, CH
  /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i, // UK
  /^\d{5}(-\d{4})?$/, // US
];

/**
 * Analysiert ob ein Wert wie ein Firmenname aussieht
 */
function looksLikeCompanyName(value: string): boolean {
  const lower = value.toLowerCase().trim();

  // Leerer Wert
  if (!lower) return false;

  // Enthält typische Firmenbezeichnungen?
  for (const indicator of COMPANY_INDICATORS) {
    if (lower.includes(indicator)) {
      return true;
    }
  }

  // Enthält "&" oder "und" (oft in Firmennamen)
  if (lower.includes(" & ") || lower.includes(" und ")) {
    return true;
  }

  // Mehr als 3 Wörter = eher Firmenname
  const words = lower.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 4) {
    return true;
  }

  // Enthält Zahlen (z.B. "Restaurant 1900")
  if (/\d/.test(lower) && words.length >= 2) {
    return true;
  }

  return false;
}

/**
 * Analysiert ob ein Wert wie ein Personenname aussieht
 */
function looksLikePersonName(value: string): boolean {
  const lower = value.toLowerCase().trim();

  // Leerer Wert
  if (!lower) return false;

  // Splitten in Wörter
  const words = lower.split(/\s+/).filter(w => w.length > 1);

  // Personennamen haben meist 1-3 Wörter
  if (words.length < 1 || words.length > 4) {
    return false;
  }

  // Prüfe ob erstes Wort ein bekannter Vorname ist
  if (words.length >= 1) {
    const firstName = words[0].replace(/[^a-zäöüß]/g, '');
    if (COMMON_FIRST_NAMES.includes(firstName)) {
      return true;
    }
  }

  // Typisches Format: "Vorname Nachname" (2 Wörter, beide kapitalisiert im Original)
  if (words.length === 2) {
    const original = value.trim();
    const parts = original.split(/\s+/);
    if (parts.length === 2 &&
        parts[0][0] === parts[0][0].toUpperCase() &&
        parts[1][0] === parts[1][0].toUpperCase() &&
        parts[0].length >= 2 && parts[0].length <= 15 &&
        parts[1].length >= 2 && parts[1].length <= 20) {
      // Aber nicht wenn es wie eine Firma aussieht
      if (!looksLikeCompanyName(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Analysiert ob ein Wert wie eine Adresse aussieht
 */
function looksLikeAddress(value: string): boolean {
  const lower = value.toLowerCase().trim();

  // Enthält Straßen-Indikatoren?
  for (const indicator of ADDRESS_INDICATORS) {
    if (lower.includes(indicator)) {
      return true;
    }
  }

  // Enthält PLZ-Pattern?
  for (const pattern of PLZ_PATTERNS) {
    const words = value.split(/[\s,]+/);
    for (const word of words) {
      if (pattern.test(word)) {
        return true;
      }
    }
  }

  // Enthält Hausnummer-Pattern (z.B. "12a", "123")
  if (/\b\d{1,4}[a-z]?\b/i.test(value) && value.length > 10) {
    return true;
  }

  return false;
}

/**
 * Semantic Content Type - was für ein INHALT ist das wirklich?
 */
export type SemanticContentType =
  | "company_name"
  | "person_name"
  | "first_name"
  | "last_name"
  | "full_address"
  | "email"
  | "phone"
  | "url"
  | "rating"
  | "review_count"
  | "category"
  | "id"
  | "text"
  | "number"
  | "unknown";

/**
 * Analysiert den Inhalt einer Spalte und bestimmt den semantischen Typ
 */
export function analyzeColumnContent(
  header: string,
  sampleValues: string[]
): { semanticType: SemanticContentType; confidence: number; reason: string } {
  const headerLower = header.toLowerCase().trim();
  const cleanValues = sampleValues.filter(v => v && v.trim() !== "").slice(0, 20);

  if (cleanValues.length === 0) {
    return { semanticType: "unknown", confidence: 0, reason: "Keine Daten" };
  }

  // 1. Prüfe spezifische Datenformate zuerst (Email, URL, Phone)
  const emailCount = cleanValues.filter(v => EMAIL_REGEX.test(v.trim())).length;
  if (emailCount / cleanValues.length >= 0.5) {
    return { semanticType: "email", confidence: emailCount / cleanValues.length, reason: "Email-Format erkannt" };
  }

  // URL-Erkennung: Nur echte Business-Websites, keine Google Maps Links etc.
  const urlCount = cleanValues.filter(v => isBusinessWebsiteUrl(v.trim())).length;
  const nonWebsiteUrlCount = cleanValues.filter(v => {
    const trimmed = v.trim();
    const isUrl = URL_REGEX.test(trimmed) || trimmed.startsWith("http") || trimmed.startsWith("www.");
    return isUrl && !isBusinessWebsiteUrl(trimmed);
  }).length;

  // Wenn die meisten URLs Google Maps o.ä. sind, ist es KEINE Website-Spalte
  if (nonWebsiteUrlCount > urlCount && nonWebsiteUrlCount / cleanValues.length >= 0.3) {
    return { semanticType: "text", confidence: 0.7, reason: "URLs sind Google Maps/Social Media Links, keine Websites" };
  }

  if (urlCount / cleanValues.length >= 0.5) {
    return { semanticType: "url", confidence: urlCount / cleanValues.length, reason: "Website-URLs erkannt" };
  }

  const phoneCount = cleanValues.filter(v => isPhoneNumber(v.trim())).length;
  if (phoneCount / cleanValues.length >= 0.5) {
    return { semanticType: "phone", confidence: phoneCount / cleanValues.length, reason: "Telefon-Format erkannt" };
  }

  // 2. ID-Spalten erkennen (place_id, id, etc.)
  if (headerLower.includes("id") || headerLower === "place_id" || headerLower === "placeId") {
    return { semanticType: "id", confidence: 0.95, reason: "ID-Spalte basierend auf Header" };
  }

  // 3. Rating erkennen (Zahlen zwischen 1-5)
  if (headerLower.includes("rating") || headerLower.includes("bewertung") || headerLower.includes("stars")) {
    const ratingCount = cleanValues.filter(v => {
      const num = parseFloat(v.replace(",", "."));
      return !isNaN(num) && num >= 1 && num <= 5;
    }).length;
    if (ratingCount / cleanValues.length >= 0.5) {
      return { semanticType: "rating", confidence: 0.9, reason: "Rating-Werte (1-5) erkannt" };
    }
  }

  // 4. Review Count erkennen
  if (headerLower.includes("review") && (headerLower.includes("count") || headerLower.includes("anzahl"))) {
    return { semanticType: "review_count", confidence: 0.9, reason: "Review-Anzahl basierend auf Header" };
  }

  // 5. Kategorie erkennen
  if (headerLower.includes("category") || headerLower.includes("kategorie") || headerLower.includes("type") || headerLower.includes("branche")) {
    return { semanticType: "category", confidence: 0.85, reason: "Kategorie basierend auf Header" };
  }

  // 6. WICHTIG: Firmenname vs. Personenname unterscheiden!
  const companyCount = cleanValues.filter(v => looksLikeCompanyName(v)).length;
  const personCount = cleanValues.filter(v => looksLikePersonName(v)).length;

  // Wenn Header "company", "name", "title", "business" enthält - prüfe Inhalt!
  if (headerLower.includes("company") || headerLower.includes("firma") ||
      headerLower.includes("name") || headerLower.includes("title") ||
      headerLower.includes("business")) {

    // Wenn Inhalt wie Firmennamen aussieht
    if (companyCount >= personCount && companyCount / cleanValues.length >= 0.3) {
      return {
        semanticType: "company_name",
        confidence: Math.max(0.7, companyCount / cleanValues.length),
        reason: `${companyCount}/${cleanValues.length} Werte sehen wie Firmennamen aus`
      };
    }

    // Wenn Inhalt wie Personennamen aussieht
    if (personCount > companyCount && personCount / cleanValues.length >= 0.3) {
      return {
        semanticType: "person_name",
        confidence: Math.max(0.7, personCount / cleanValues.length),
        reason: `${personCount}/${cleanValues.length} Werte sehen wie Personennamen aus`
      };
    }

    // Default: Wenn Header "company" sagt, dann ist es wahrscheinlich Firmenname
    if (headerLower.includes("company") || headerLower.includes("firma") || headerLower.includes("business")) {
      return { semanticType: "company_name", confidence: 0.7, reason: "Firmenname basierend auf Header" };
    }
  }

  // 7. Vorname/Nachname spezifisch
  if (headerLower.includes("vorname") || headerLower.includes("first") || headerLower === "firstname") {
    return { semanticType: "first_name", confidence: 0.9, reason: "Vorname basierend auf Header" };
  }
  if (headerLower.includes("nachname") || headerLower.includes("last") || headerLower.includes("surname") || headerLower === "lastname") {
    return { semanticType: "last_name", confidence: 0.9, reason: "Nachname basierend auf Header" };
  }

  // 8. Adresse erkennen
  if (headerLower.includes("address") || headerLower.includes("adresse") || headerLower.includes("street") || headerLower.includes("location")) {
    const addressCount = cleanValues.filter(v => looksLikeAddress(v)).length;
    if (addressCount / cleanValues.length >= 0.3) {
      return { semanticType: "full_address", confidence: 0.85, reason: "Adress-Format erkannt" };
    }
    return { semanticType: "full_address", confidence: 0.7, reason: "Adresse basierend auf Header" };
  }

  // 9. Reine Zahlen
  const numberCount = cleanValues.filter(v => isNumber(v.trim())).length;
  if (numberCount / cleanValues.length >= 0.8) {
    return { semanticType: "number", confidence: numberCount / cleanValues.length, reason: "Zahlen erkannt" };
  }

  // 10. Fallback: Text
  return { semanticType: "text", confidence: 0.5, reason: "Allgemeiner Text" };
}

// Spezifische Header-Namen für bessere Erkennung (exakte Matches)
const EXACT_HEADER_MATCHES: Record<string, ColumnType> = {
  "name": ColumnType.TEXT, // "name" allein ist oft Firmenname, nicht Person
  "title": ColumnType.TEXT,
  "titel": ColumnType.TEXT,
  "beschreibung": ColumnType.TEXT,
  "description": ColumnType.TEXT,
  "notizen": ColumnType.TEXT,
  "notes": ColumnType.TEXT,
  "kommentar": ColumnType.TEXT,
  "comment": ColumnType.TEXT,
};

interface DetectionResult {
  type: ColumnType;
  confidence: number; // 0-1
  reason: string;
}

/**
 * Erkennt den Spaltentyp basierend auf Header und Sample-Daten
 */
export function detectColumnType(
  header: string,
  sampleValues: string[],
  allHeaders?: string[]
): DetectionResult {
  const headerLower = header.toLowerCase().trim();
  const cleanValues = sampleValues.filter(v => v && v.trim() !== "");

  // 1. Prüfe exakte Header-Matches zuerst
  if (EXACT_HEADER_MATCHES[headerLower]) {
    return {
      type: EXACT_HEADER_MATCHES[headerLower],
      confidence: 0.95,
      reason: `Exact header match for "${header}"`,
    };
  }

  // 2. Prüfe Header-Keywords
  for (const [type, keywords] of Object.entries(HEADER_KEYWORDS)) {
    if (keywords.length === 0) continue;

    for (const keyword of keywords) {
      // Prüfe ob Header das Keyword enthält (als ganzes Wort oder Teil)
      if (headerLower === keyword ||
          headerLower.includes(keyword) ||
          headerLower.split(/[\s_\-.]/).some(part => part === keyword)) {

        // Bei bestimmten Typen zusätzliche Datenvalidierung
        if (type === ColumnType.PHONE && cleanValues.length > 0) {
          const phoneMatches = cleanValues.filter(v => isPhoneNumber(v)).length;
          if (phoneMatches / cleanValues.length < 0.3) {
            continue; // Header sagt Phone, aber Daten passen nicht
          }
        }

        return {
          type: type as ColumnType,
          confidence: 0.9,
          reason: `Header contains keyword "${keyword}"`,
        };
      }
    }
  }

  // 3. Analysiere Daten-Patterns wenn keine Header-Keywords gefunden
  if (cleanValues.length > 0) {
    const dataTypeResult = analyzeDataPatterns(cleanValues);
    if (dataTypeResult.confidence > 0.6) {
      return dataTypeResult;
    }
  }

  // 4. Fallback: TEXT
  return {
    type: ColumnType.TEXT,
    confidence: 0.5,
    reason: "Default fallback to TEXT",
  };
}

/**
 * Analysiert die Daten-Patterns um den Typ zu erkennen
 */
function analyzeDataPatterns(values: string[]): DetectionResult {
  const total = values.length;
  if (total === 0) {
    return { type: ColumnType.TEXT, confidence: 0, reason: "No data" };
  }

  // Zähle Matches für jeden Typ
  const counts = {
    email: 0,
    url: 0,           // Echte Business-Websites
    nonWebsiteUrl: 0, // Google Maps, Social Media, etc.
    phone: 0,
    number: 0,
    date: 0,
  };

  for (const value of values) {
    const trimmed = value.trim();

    if (EMAIL_REGEX.test(trimmed)) {
      counts.email++;
    } else if (isBusinessWebsiteUrl(trimmed)) {
      counts.url++;
    } else if (URL_REGEX.test(trimmed) || trimmed.startsWith("http") || trimmed.startsWith("www.")) {
      counts.nonWebsiteUrl++; // Google Maps, Social Media, etc.
    } else if (isPhoneNumber(trimmed)) {
      counts.phone++;
    } else if (isDate(trimmed)) {
      counts.date++;
    } else if (isNumber(trimmed)) {
      counts.number++;
    }
  }

  // Finde den besten Match (mind. 50% der Werte müssen passen)
  const threshold = 0.5;

  // Priorisiere spezifischere Typen
  if (counts.email / total >= threshold) {
    return {
      type: ColumnType.EMAIL,
      confidence: counts.email / total,
      reason: `${counts.email}/${total} values match email pattern`,
    };
  }

  // Nur echte Business-Websites als URL erkennen
  if (counts.url / total >= threshold) {
    return {
      type: ColumnType.URL,
      confidence: counts.url / total,
      reason: `${counts.url}/${total} values are business website URLs`,
    };
  }

  // Wenn die meisten URLs Google Maps/Social Media sind, als TEXT behandeln
  if (counts.nonWebsiteUrl / total >= threshold) {
    return {
      type: ColumnType.TEXT,
      confidence: 0.7,
      reason: `${counts.nonWebsiteUrl}/${total} values are Google Maps/Social Media links (not business websites)`,
    };
  }

  // Phone braucht höhere Schwelle (70%) weil Regex fehleranfälliger ist
  if (counts.phone / total >= 0.7) {
    return {
      type: ColumnType.PHONE,
      confidence: counts.phone / total,
      reason: `${counts.phone}/${total} values match phone pattern`,
    };
  }

  if (counts.date / total >= threshold) {
    return {
      type: ColumnType.DATE,
      confidence: counts.date / total,
      reason: `${counts.date}/${total} values match date pattern`,
    };
  }

  // Number muss nahezu alle Werte sein (90%) um sicher zu sein
  if (counts.number / total >= 0.9) {
    return {
      type: ColumnType.NUMBER,
      confidence: counts.number / total,
      reason: `${counts.number}/${total} values are numbers`,
    };
  }

  return {
    type: ColumnType.TEXT,
    confidence: 0.5,
    reason: "No dominant pattern found",
  };
}

/**
 * Strenge Telefonnummer-Prüfung
 */
function isPhoneNumber(value: string): boolean {
  const cleaned = value.trim();

  // Zu kurz oder zu lang für Telefonnummer
  if (cleaned.length < 7 || cleaned.length > 25) {
    return false;
  }

  // Muss mit +, 0 oder ( beginnen
  if (!/^[\+0(]/.test(cleaned)) {
    return false;
  }

  // Prüfe gegen Telefon-Patterns
  if (PHONE_REGEX.test(cleaned) ||
      GERMAN_PHONE_REGEX.test(cleaned.replace(/\s/g, '')) ||
      INTERNATIONAL_PHONE_REGEX.test(cleaned.replace(/[\s\-]/g, ''))) {
    return true;
  }

  // Zusätzliche Heuristik: Ziffern-Anteil und Struktur
  const digitsOnly = cleaned.replace(/\D/g, '');
  const digitRatio = digitsOnly.length / cleaned.length;

  // Mindestens 60% Ziffern und zwischen 7-15 Ziffern
  if (digitRatio >= 0.6 && digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    // Aber keine reinen Zahlen (die wären eher NUMBER)
    if (cleaned !== digitsOnly) {
      return true;
    }
  }

  return false;
}

/**
 * Datum-Prüfung
 */
function isDate(value: string): boolean {
  const trimmed = value.trim();

  // Prüfe bekannte Patterns
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Versuche als Date zu parsen
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    // Stelle sicher dass es kein reiner Number-String ist
    if (!/^\d+$/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Nummer-Prüfung
 */
function isNumber(value: string): boolean {
  const trimmed = value.trim();

  // Leer
  if (!trimmed) return false;

  // Entferne Tausender-Trennzeichen und Währungssymbole
  const cleaned = trimmed
    .replace(/[€$£¥]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.'); // Deutsche Dezimalformat

  // Wenn mehrere Punkte, dann Tausender-Format
  if ((cleaned.match(/\./g) || []).length > 1) {
    const withoutDots = cleaned.replace(/\./g, '');
    return !isNaN(parseFloat(withoutDots)) && isFinite(parseFloat(withoutDots));
  }

  return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

/**
 * Prüft auf doppelte Header und gibt Warnungen zurück
 */
export function checkDuplicateHeaders(headers: string[]): {
  valid: boolean;
  duplicates: string[];
  suggestions: Map<string, string>;
} {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  const suggestions = new Map<string, string>();

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();
    const count = seen.get(normalized) || 0;

    if (count > 0) {
      duplicates.push(header);
      suggestions.set(`${header}_${index}`, `${header}_${count + 1}`);
    }

    seen.set(normalized, count + 1);
  });

  return {
    valid: duplicates.length === 0,
    duplicates,
    suggestions,
  };
}

/**
 * Validiert Daten basierend auf erkanntem Typ
 * HINWEIS: Validierung ist bewusst locker gehalten um JSON-Daten und
 * spezielle Formate durchzulassen. Diese werden trotzdem als TEXT importiert.
 */
export function validateCellValue(
  value: string,
  type: ColumnType
): { valid: boolean; error?: string; suggestion?: string } {
  const trimmed = value?.trim() || '';

  // Leere Werte sind immer OK
  if (!trimmed) {
    return { valid: true };
  }

  // JSON-Daten (Arrays/Objekte) sind immer OK - werden als TEXT behandelt
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return { valid: true };
  }

  switch (type) {
    case ColumnType.EMAIL:
      if (!EMAIL_REGEX.test(trimmed)) {
        // Nur warnen wenn es wirklich wie eine kaputte Email aussieht
        if (trimmed.includes("@")) {
          return {
            valid: false,
            error: "Invalid email format",
          };
        }
        // Sonst ist es wahrscheinlich kein Email-Feld
        return { valid: true };
      }
      break;

    case ColumnType.URL:
      // URLs die mit http/https beginnen sind immer OK (auch wenn abgeschnitten)
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return { valid: true };
      }
      // www. URLs sind auch OK
      if (trimmed.startsWith("www.")) {
        return { valid: true };
      }
      // Sonst keine strenge Validierung - könnte ein anderer Wert sein
      return { valid: true };

    case ColumnType.NUMBER:
      // Nur validieren wenn es wirklich wie eine Zahl aussehen sollte
      // JSON-Arrays und Objekte werden oben schon abgefangen
      if (!isNumber(trimmed) && /^[\d\s,.\-€$%]+$/.test(trimmed)) {
        return { valid: false, error: "Not a valid number" };
      }
      return { valid: true };

    case ColumnType.DATE:
      // Zeitzonen-Strings sind OK (Europe/Berlin, etc.)
      if (trimmed.includes("/") && !trimmed.includes(" ")) {
        return { valid: true };
      }
      // Nur validieren wenn es wie ein Datum aussieht
      if (/^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}/.test(trimmed)) {
        if (!isDate(trimmed)) {
          return { valid: false, error: "Not a valid date" };
        }
      }
      return { valid: true };
  }

  return { valid: true };
}

/**
 * Batch-Validierung für eine komplette CSV
 */
export function validateCSVData(
  headers: string[],
  rows: string[][],
  columnTypes: ColumnType[]
): {
  valid: boolean;
  errors: Array<{
    row: number;
    column: string;
    value: string;
    error: string;
  }>;
  warnings: string[];
} {
  const errors: Array<{
    row: number;
    column: string;
    value: string;
    error: string;
  }> = [];
  const warnings: string[] = [];

  // Prüfe Header-Duplikate
  const headerCheck = checkDuplicateHeaders(headers);
  if (!headerCheck.valid) {
    warnings.push(`Duplicate headers found: ${headerCheck.duplicates.join(", ")}`);
  }

  // Prüfe Daten
  rows.forEach((row, rowIndex) => {
    // Prüfe Spaltenanzahl
    if (row.length !== headers.length) {
      warnings.push(`Row ${rowIndex + 1} has ${row.length} columns, expected ${headers.length}`);
    }

    row.forEach((cell, colIndex) => {
      if (colIndex >= columnTypes.length) return;

      const validation = validateCellValue(cell, columnTypes[colIndex]);
      if (!validation.valid) {
        errors.push({
          row: rowIndex + 1,
          column: headers[colIndex] || `Column ${colIndex + 1}`,
          value: cell.substring(0, 50),
          error: validation.error || "Invalid value",
        });
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors: errors.slice(0, 100), // Limitiere auf 100 Fehler
    warnings,
  };
}
