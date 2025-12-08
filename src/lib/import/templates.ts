import { ColumnType } from "@prisma/client";
import { analyzeColumnContent, SemanticContentType } from "./column-detection";

/**
 * Tabellen-Vorlagen für verschiedene Lead-Typen
 * Jede Vorlage definiert die Spalten und deren Mapping zu CSV-Headern
 */

export interface TemplateColumn {
  name: string;           // Anzeigename der Spalte
  type: ColumnType;       // Spaltentyp
  csvHeaders: string[];   // Mögliche CSV-Header-Namen für Auto-Mapping
  required: boolean;      // Pflichtfeld (muss in CSV vorhanden sein)
  autoFill: boolean;      // Wird automatisch aus CSV befüllt
  description?: string;   // Beschreibung für den Benutzer
  width?: number;         // Spaltenbreite
  aiGenerated?: boolean;  // Wird von KI generiert
}

export interface TableTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;           // Lucide Icon Name
  category: string;
  columns: TemplateColumn[];
}

// ============================================
// VORLAGEN
// ============================================

export const TABLE_TEMPLATES: TableTemplate[] = [
  {
    id: "webdesign-leads",
    name: "Webdesign Leads",
    description: "Vorlage für Webdesign & Agentur Leads mit Kontaktdaten und Bewertungen",
    icon: "Globe",
    category: "Leads",
    columns: [
      {
        name: "Company",
        type: ColumnType.COMPANY,
        csvHeaders: ["company", "firma", "business_name", "name", "title", "business name"],
        required: true,
        autoFill: true,
        description: "Firmenname aus Google Maps",
        width: 250,
      },
      {
        name: "Website",
        type: ColumnType.URL,
        csvHeaders: ["website", "webseite", "url", "site", "web"],
        required: false,
        autoFill: true,
        description: "Website der Firma",
        width: 200,
      },
      {
        name: "Vorname",
        type: ColumnType.TEXT,
        csvHeaders: ["vorname", "first_name", "firstname", "first name"],
        required: false,
        autoFill: false,
        description: "Wird manuell oder per Scraping befüllt",
        width: 150,
      },
      {
        name: "Nachname",
        type: ColumnType.TEXT,
        csvHeaders: ["nachname", "last_name", "lastname", "last name", "surname"],
        required: false,
        autoFill: false,
        description: "Wird manuell oder per Scraping befüllt",
        width: 150,
      },
      {
        name: "Email",
        type: ColumnType.EMAIL,
        csvHeaders: ["email", "e-mail", "mail", "contact_email"],
        required: false,
        autoFill: false,
        description: "Wird manuell oder per Scraping befüllt",
        width: 220,
      },
      {
        name: "Kompliment",
        type: ColumnType.AI_GENERATED,
        csvHeaders: ["kompliment", "compliment", "personalized_message"],
        required: false,
        autoFill: false,
        aiGenerated: true,
        description: "Personalisiertes Kompliment (KI-generiert)",
        width: 300,
      },
      {
        name: "Rating",
        type: ColumnType.NUMBER,
        csvHeaders: ["rating", "bewertung", "stars", "score", "reviews_rating"],
        required: false,
        autoFill: true,
        description: "Google Bewertung (1-5 Sterne)",
        width: 100,
      },
      {
        name: "Reviews",
        type: ColumnType.NUMBER,
        csvHeaders: ["reviews", "reviews_count", "review_count", "anzahl_bewertungen", "bewertungen"],
        required: false,
        autoFill: true,
        description: "Anzahl der Bewertungen",
        width: 100,
      },
      {
        name: "Review Keywords",
        type: ColumnType.TEXT,
        csvHeaders: ["reviews_keywords", "review_keywords", "keywords", "schlagwörter", "review keywords", "reviews keywords"],
        required: false,
        autoFill: true,
        description: "Keywords aus Kundenbewertungen für Personalisierung",
        width: 250,
      },
      {
        name: "Review Text",
        type: ColumnType.TEXT,
        csvHeaders: ["review_text", "review text", "reviews_text", "bewertungstext", "rezensionen", "reviews_full"],
        required: false,
        autoFill: true,
        description: "Vollständige Bewertungstexte (JSON-komprimiert)",
        width: 300,
      },
      {
        name: "Telefon",
        type: ColumnType.PHONE,
        csvHeaders: ["phone", "telefon", "tel", "phone_number"],
        required: false,
        autoFill: true,
        description: "Telefonnummer",
        width: 150,
      },
      {
        name: "Adresse",
        type: ColumnType.ADDRESS,
        csvHeaders: ["address", "adresse", "full_address", "street", "location"],
        required: false,
        autoFill: true,
        description: "Vollständige Adresse",
        width: 250,
      },
      {
        name: "Status",
        type: ColumnType.STATUS,
        csvHeaders: ["status", "lead_status"],
        required: false,
        autoFill: false,
        description: "Lead-Status (Neu, Kontaktiert, etc.)",
        width: 120,
      },
    ],
  },
  {
    id: "restaurant-leads",
    name: "Restaurant Leads",
    description: "Vorlage für Restaurant & Gastro Leads",
    icon: "UtensilsCrossed",
    category: "Leads",
    columns: [
      {
        name: "Restaurant",
        type: ColumnType.COMPANY,
        csvHeaders: ["company", "name", "title", "restaurant", "business_name"],
        required: true,
        autoFill: true,
        width: 250,
      },
      {
        name: "Küche",
        type: ColumnType.SELECT,
        csvHeaders: ["cuisine", "category", "kategorie", "type"],
        required: false,
        autoFill: true,
        description: "Art der Küche",
        width: 150,
      },
      {
        name: "Website",
        type: ColumnType.URL,
        csvHeaders: ["website", "url", "webseite"],
        required: false,
        autoFill: true,
        width: 200,
      },
      {
        name: "Inhaber",
        type: ColumnType.PERSON,
        csvHeaders: ["owner", "inhaber", "contact"],
        required: false,
        autoFill: false,
        width: 180,
      },
      {
        name: "Email",
        type: ColumnType.EMAIL,
        csvHeaders: ["email", "e-mail", "mail"],
        required: false,
        autoFill: false,
        width: 220,
      },
      {
        name: "Telefon",
        type: ColumnType.PHONE,
        csvHeaders: ["phone", "telefon", "tel"],
        required: false,
        autoFill: true,
        width: 150,
      },
      {
        name: "Rating",
        type: ColumnType.NUMBER,
        csvHeaders: ["rating", "bewertung", "stars"],
        required: false,
        autoFill: true,
        width: 100,
      },
      {
        name: "Reviews",
        type: ColumnType.NUMBER,
        csvHeaders: ["reviews", "reviews_count"],
        required: false,
        autoFill: true,
        width: 100,
      },
      {
        name: "Review Keywords",
        type: ColumnType.TEXT,
        csvHeaders: ["reviews_keywords", "review_keywords", "keywords", "schlagwörter"],
        required: false,
        autoFill: true,
        description: "Keywords aus Kundenbewertungen",
        width: 250,
      },
      {
        name: "Review Text",
        type: ColumnType.TEXT,
        csvHeaders: ["review_text", "review text", "reviews_text", "bewertungstext", "rezensionen"],
        required: false,
        autoFill: true,
        description: "Vollständige Bewertungstexte (JSON-komprimiert)",
        width: 300,
      },
      {
        name: "Adresse",
        type: ColumnType.ADDRESS,
        csvHeaders: ["address", "adresse", "full_address"],
        required: false,
        autoFill: true,
        width: 250,
      },
      {
        name: "Kompliment",
        type: ColumnType.AI_GENERATED,
        csvHeaders: ["kompliment", "compliment"],
        required: false,
        autoFill: false,
        aiGenerated: true,
        width: 300,
      },
      {
        name: "Status",
        type: ColumnType.STATUS,
        csvHeaders: ["status"],
        required: false,
        autoFill: false,
        width: 120,
      },
    ],
  },
  {
    id: "local-business",
    name: "Lokale Unternehmen",
    description: "Allgemeine Vorlage für lokale Geschäfte",
    icon: "Store",
    category: "Leads",
    columns: [
      {
        name: "Unternehmen",
        type: ColumnType.COMPANY,
        csvHeaders: ["company", "name", "title", "business_name", "firma"],
        required: true,
        autoFill: true,
        width: 250,
      },
      {
        name: "Branche",
        type: ColumnType.SELECT,
        csvHeaders: ["category", "branche", "industry", "type", "kategorie"],
        required: false,
        autoFill: true,
        width: 150,
      },
      {
        name: "Website",
        type: ColumnType.URL,
        csvHeaders: ["website", "url", "webseite"],
        required: false,
        autoFill: true,
        width: 200,
      },
      {
        name: "Ansprechpartner",
        type: ColumnType.PERSON,
        csvHeaders: ["contact", "ansprechpartner", "owner", "inhaber"],
        required: false,
        autoFill: false,
        width: 180,
      },
      {
        name: "Email",
        type: ColumnType.EMAIL,
        csvHeaders: ["email", "e-mail", "mail"],
        required: false,
        autoFill: false,
        width: 220,
      },
      {
        name: "Telefon",
        type: ColumnType.PHONE,
        csvHeaders: ["phone", "telefon", "tel"],
        required: false,
        autoFill: true,
        width: 150,
      },
      {
        name: "Rating",
        type: ColumnType.NUMBER,
        csvHeaders: ["rating", "bewertung"],
        required: false,
        autoFill: true,
        width: 100,
      },
      {
        name: "Reviews",
        type: ColumnType.NUMBER,
        csvHeaders: ["reviews", "reviews_count"],
        required: false,
        autoFill: true,
        width: 100,
      },
      {
        name: "Review Keywords",
        type: ColumnType.TEXT,
        csvHeaders: ["reviews_keywords", "review_keywords", "keywords", "schlagwörter"],
        required: false,
        autoFill: true,
        description: "Keywords aus Kundenbewertungen",
        width: 250,
      },
      {
        name: "Review Text",
        type: ColumnType.TEXT,
        csvHeaders: ["review_text", "review text", "reviews_text", "bewertungstext", "rezensionen"],
        required: false,
        autoFill: true,
        description: "Vollständige Bewertungstexte (JSON-komprimiert)",
        width: 300,
      },
      {
        name: "Adresse",
        type: ColumnType.ADDRESS,
        csvHeaders: ["address", "adresse", "full_address"],
        required: false,
        autoFill: true,
        width: 250,
      },
      {
        name: "Kompliment",
        type: ColumnType.AI_GENERATED,
        csvHeaders: ["kompliment", "compliment"],
        required: false,
        autoFill: false,
        aiGenerated: true,
        description: "Personalisiertes Kompliment (KI-generiert)",
        width: 300,
      },
      {
        name: "Notizen",
        type: ColumnType.TEXT,
        csvHeaders: ["notes", "notizen", "bemerkungen"],
        required: false,
        autoFill: false,
        width: 300,
      },
      {
        name: "Status",
        type: ColumnType.STATUS,
        csvHeaders: ["status"],
        required: false,
        autoFill: false,
        width: 120,
      },
    ],
  },
  {
    id: "custom",
    name: "Benutzerdefiniert",
    description: "Alle Spalten aus der CSV-Datei übernehmen",
    icon: "Settings",
    category: "Andere",
    columns: [], // Wird dynamisch aus CSV generiert
  },
];

/**
 * Findet das beste Mapping zwischen CSV-Headern und Template-Spalten
 * INTELLIGENTE VERSION: Analysiert auch den Inhalt der Spalten!
 */
export function mapCsvToTemplate(
  csvHeaders: string[],
  template: TableTemplate,
  previewRows?: string[][] // NEU: Sample-Daten für intelligente Analyse
): Map<string, { templateColumn: TemplateColumn; csvHeader: string; csvIndex: number; confidence?: number; reason?: string } | null> {
  const mapping = new Map<string, { templateColumn: TemplateColumn; csvHeader: string; csvIndex: number; confidence?: number; reason?: string } | null>();
  const usedCsvIndices = new Set<number>();

  // Zuerst: Analysiere ALLE CSV-Spalten und deren Inhalte
  const columnAnalysis: Map<number, { semanticType: string; confidence: number; reason: string }> = new Map();

  if (previewRows && previewRows.length > 0) {
    for (let i = 0; i < csvHeaders.length; i++) {
      const sampleValues = previewRows.map(row => row[i] || "").filter(v => v.trim() !== "");
      const analysis = analyzeColumnContent(csvHeaders[i], sampleValues);
      columnAnalysis.set(i, analysis);
    }
  }

  // Mapping von SemanticType zu Template-Spalten-Namen
  const semanticToTemplateColumn: Record<string, string[]> = {
    "company_name": ["Company", "Restaurant", "Unternehmen", "Firma"],
    "person_name": ["Ansprechpartner", "Inhaber", "Kontakt"],
    "first_name": ["Vorname"],
    "last_name": ["Nachname"],
    "full_address": ["Adresse", "Address"],
    "email": ["Email", "E-Mail"],
    "phone": ["Telefon", "Phone"],
    "url": ["Website", "Webseite"],
    "rating": ["Rating", "Bewertung"],
    "review_count": ["Reviews", "Bewertungen"],
    "category": ["Branche", "Küche", "Kategorie", "Category"],
  };

  // Für jede Template-Spalte, finde den passenden CSV-Header
  for (const templateCol of template.columns) {
    let bestMatch: { csvHeader: string; csvIndex: number; confidence?: number; reason?: string } | null = null;
    let bestConfidence = 0;

    // SCHRITT 1: Prüfe ob eine Spalte semantisch zum Template-Feld passt
    for (let i = 0; i < csvHeaders.length; i++) {
      if (usedCsvIndices.has(i)) continue;

      const analysis = columnAnalysis.get(i);
      if (analysis && analysis.confidence > 0.6) {
        // Prüfe ob der semantische Typ zu dieser Template-Spalte passt
        const matchingTemplateColumns = semanticToTemplateColumn[analysis.semanticType] || [];

        if (matchingTemplateColumns.includes(templateCol.name)) {
          // Semantischer Match gefunden!
          if (analysis.confidence > bestConfidence) {
            bestMatch = {
              csvHeader: csvHeaders[i],
              csvIndex: i,
              confidence: analysis.confidence,
              reason: `Inhalt erkannt: ${analysis.reason}`
            };
            bestConfidence = analysis.confidence;
          }
        }
      }
    }

    // SCHRITT 2: Falls kein semantischer Match, nutze Header-basiertes Matching
    if (!bestMatch) {
      for (const possibleHeader of templateCol.csvHeaders) {
        const headerLower = possibleHeader.toLowerCase();

        for (let i = 0; i < csvHeaders.length; i++) {
          if (usedCsvIndices.has(i)) continue;

          const csvHeaderLower = csvHeaders[i].toLowerCase().trim();

          // Exakter Match
          if (csvHeaderLower === headerLower) {
            // Aber prüfe den Inhalt! Wenn Header "name" sagt aber Firmen drin sind...
            const analysis = columnAnalysis.get(i);

            // Spezialfall: Header sagt etwas anderes als der Inhalt
            if (analysis && analysis.confidence > 0.7) {
              // Wenn der Inhalt klar etwas anderes ist, überspringe
              if (templateCol.name === "Vorname" && analysis.semanticType === "company_name") {
                continue; // "name"-Header mit Firmennamen -> nicht als Vorname
              }
              if (templateCol.name === "Nachname" && analysis.semanticType === "company_name") {
                continue;
              }
            }

            bestMatch = { csvHeader: csvHeaders[i], csvIndex: i, confidence: 0.8, reason: "Header-Match" };
            break;
          }

          // Enthält den Header-Namen
          if (csvHeaderLower.includes(headerLower) || headerLower.includes(csvHeaderLower)) {
            if (!bestMatch) {
              bestMatch = { csvHeader: csvHeaders[i], csvIndex: i, confidence: 0.6, reason: "Teilweiser Header-Match" };
            }
          }
        }

        if (bestMatch && bestMatch.confidence && bestMatch.confidence >= 0.8) break;
      }
    }

    if (bestMatch) {
      usedCsvIndices.add(bestMatch.csvIndex);
      mapping.set(templateCol.name, {
        templateColumn: templateCol,
        csvHeader: bestMatch.csvHeader,
        csvIndex: bestMatch.csvIndex,
        confidence: bestMatch.confidence,
        reason: bestMatch.reason,
      });
    } else {
      // Spalte existiert nicht in CSV - wird leer angelegt
      mapping.set(templateCol.name, null);
    }
  }

  return mapping;
}

/**
 * Gibt die Vorlage nach ID zurück
 */
export function getTemplateById(id: string): TableTemplate | undefined {
  return TABLE_TEMPLATES.find((t) => t.id === id);
}

/**
 * Gibt alle Vorlagen einer Kategorie zurück
 */
export function getTemplatesByCategory(category: string): TableTemplate[] {
  return TABLE_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Analysiert ALLE Spalten einer Datei und gibt semantische Typen zurück
 * Nützlich für UI um dem Benutzer zu zeigen was erkannt wurde
 */
export interface ColumnAnalysisResult {
  header: string;
  index: number;
  semanticType: SemanticContentType;
  confidence: number;
  reason: string;
  suggestedMapping?: string; // Vorgeschlagene Template-Spalte
}

export function analyzeAllColumns(
  headers: string[],
  previewRows: string[][]
): ColumnAnalysisResult[] {
  const results: ColumnAnalysisResult[] = [];

  // Mapping von SemanticType zu Template-Spalten
  const semanticToSuggestion: Record<string, string> = {
    "company_name": "Company / Firmenname",
    "person_name": "Ansprechpartner / Kontakt",
    "first_name": "Vorname",
    "last_name": "Nachname",
    "full_address": "Adresse",
    "email": "Email",
    "phone": "Telefon",
    "url": "Website",
    "rating": "Rating / Bewertung",
    "review_count": "Anzahl Reviews",
    "category": "Kategorie / Branche",
    "id": "ID (wird ignoriert)",
    "number": "Zahl",
    "text": "Text",
    "unknown": "Unbekannt",
  };

  for (let i = 0; i < headers.length; i++) {
    const sampleValues = previewRows.map(row => row[i] || "").filter(v => v.trim() !== "");
    const analysis = analyzeColumnContent(headers[i], sampleValues);

    results.push({
      header: headers[i],
      index: i,
      semanticType: analysis.semanticType,
      confidence: analysis.confidence,
      reason: analysis.reason,
      suggestedMapping: semanticToSuggestion[analysis.semanticType] || "Text",
    });
  }

  return results;
}
