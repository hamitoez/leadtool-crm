import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { generateText, AIProvider } from "./providers";

export type { AIProvider };

/**
 * KI-Kompliment Generator für personalisierte Lead-Ansprache
 * Unterstützt mehrere KI-Anbieter: Anthropic, OpenAI, Google, Mistral, Groq, DeepSeek
 */

export interface LeadData {
  company?: string;
  firstName?: string;
  lastName?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  reviewKeywords?: string;
  reviewText?: string; // JSON-komprimierte Review-Texte
  category?: string;
  address?: string;
  email?: string;
  phone?: string;
  description?: string;
  // Zusätzliche Felder die für Personalisierung verwendet werden können
  [key: string]: string | number | undefined;
}

// Interface für geparste Reviews
interface ParsedReviews {
  count: number;
  reviews: Array<{ id: number; text: string }>;
}

/**
 * Parst JSON-komprimierte Review-Texte
 */
function parseReviewText(reviewText: string | undefined): ParsedReviews | null {
  if (!reviewText) return null;

  try {
    const parsed = JSON.parse(reviewText) as ParsedReviews;
    if (parsed.reviews && Array.isArray(parsed.reviews)) {
      return parsed;
    }
  } catch {
    // Falls kein JSON, versuche als Plaintext zu behandeln
    if (reviewText.trim()) {
      return {
        count: 1,
        reviews: [{ id: 1, text: reviewText }]
      };
    }
  }
  return null;
}

export interface ComplimentOptions {
  tone: "professional" | "friendly" | "casual";
  length: "short" | "medium" | "long";
  language: "de" | "en";
  focus?: "website" | "reviews" | "business" | "general";
  customInstructions?: string;
}

export interface GeneratedCompliment {
  compliment: string;
  confidence: number;
  reasoning?: string;
  provider?: AIProvider;
}

// Standard-Optionen
const DEFAULT_OPTIONS: ComplimentOptions = {
  tone: "professional",
  length: "medium",
  language: "de",
  focus: "general",
};

/**
 * Erstellt den Prompt für die Kompliment-Generierung
 */
function buildPrompt(lead: LeadData, options: ComplimentOptions): string {
  const toneDescriptions = {
    professional: "professionell und geschäftsmäßig",
    friendly: "freundlich und warmherzig",
    casual: "locker und ungezwungen",
  };

  const lengthDescriptions = {
    short: "1-2 Sätze (max. 50 Wörter)",
    medium: "2-3 Sätze (50-100 Wörter)",
    long: "3-4 Sätze (100-150 Wörter)",
  };

  const focusDescriptions = {
    website: "die Website und deren Design/Funktionalität",
    reviews: "die positiven Kundenbewertungen",
    business: "das Geschäftsmodell und den Service",
    general: "das Unternehmen allgemein",
  };

  // Sammle verfügbare Informationen
  const infoLines: string[] = [];

  // Kontaktperson
  if (lead.firstName || lead.lastName) {
    const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
    infoLines.push(`- Ansprechpartner: ${fullName}`);
  }

  // Unternehmensdaten
  if (lead.company) infoLines.push(`- Firmenname: ${lead.company}`);
  if (lead.website) infoLines.push(`- Website: ${lead.website}`);
  if (lead.category) infoLines.push(`- Branche/Kategorie: ${lead.category}`);
  if (lead.address) infoLines.push(`- Standort: ${lead.address}`);

  // Bewertungen - WICHTIG für Personalisierung
  if (lead.rating) infoLines.push(`- Google Bewertung: ${lead.rating} Sterne`);
  if (lead.reviews) infoLines.push(`- Anzahl Bewertungen: ${lead.reviews}`);

  if (lead.description) infoLines.push(`- Beschreibung: ${lead.description}`);

  const leadInfo = infoLines.length > 0
    ? infoLines.join("\n")
    : "- Keine detaillierten Informationen verfügbar";

  // Review Keywords als separater Block - SEHR WICHTIG für Personalisierung
  let reviewKeywordsBlock = "";

  if (lead.reviewKeywords) {
    reviewKeywordsBlock = `\n\nKEYWORDS AUS KUNDENBEWERTUNGEN:
${lead.reviewKeywords}`;
  }

  // Vollständige Review-Texte (JSON-komprimiert) - NOCH WICHTIGER
  const parsedReviews = parseReviewText(lead.reviewText as string | undefined);
  if (parsedReviews && parsedReviews.reviews.length > 0) {
    const reviewTexts = parsedReviews.reviews
      .slice(0, 10) // Maximal 10 Reviews um Token zu sparen
      .map((r, i) => `${i + 1}. "${r.text}"`)
      .join("\n");

    reviewKeywordsBlock += `\n\nVOLLSTÄNDIGE KUNDENBEWERTUNGEN (${parsedReviews.count} Bewertungen):
${reviewTexts}
${parsedReviews.count > 10 ? `\n... und ${parsedReviews.count - 10} weitere Bewertungen` : ""}

WICHTIG: Diese echten Kundenstimmen sind GOLD wert für die Personalisierung! Lies sie aufmerksam und nutze konkrete Details daraus.`;
  }

  if (reviewKeywordsBlock) {
    reviewKeywordsBlock += `\n\nDiese Bewertungen zeigen, was echte Kunden an diesem Unternehmen schätzen. NUTZE diese Informationen unbedingt für ein authentisches, personalisiertes Kompliment!`;
  }

  const languageInstructions = options.language === "de"
    ? "Schreibe das Kompliment auf Deutsch."
    : "Write the compliment in English.";

  const customInstructions = options.customInstructions
    ? `\n\nZusätzliche Anweisungen:\n${options.customInstructions}`
    : "";

  return `Du bist ein Experte für personalisierte Geschäftskommunikation. Deine Aufgabe ist es, ein authentisches, persönliches Kompliment für einen potenziellen Kunden zu schreiben.

INFORMATIONEN ZUM UNTERNEHMEN:
${leadInfo}
${reviewKeywordsBlock}

ANFORDERUNGEN:
- Ton: ${toneDescriptions[options.tone]}
- Länge: ${lengthDescriptions[options.length]}
- Fokus: ${focusDescriptions[options.focus || "general"]}
- ${languageInstructions}

WICHTIGE REGELN:
1. Das Kompliment MUSS auf den Kundenbewertungen basieren - lies sie komplett und nutze konkrete Details daraus
2. Erwähne spezifische Dinge die Kunden loben (z.B. "freundliches Team", "schneller Service", "tolle Beratung")
3. Falls ein Ansprechpartner bekannt ist, nutze den Namen für eine persönliche Ansprache
4. Kombiniere die Bewertungen mit dem Rating (z.B. "${lead.rating || "X"} Sterne bei ${lead.reviews || "vielen"} Bewertungen")
5. Sei authentisch und glaubwürdig - keine übertriebene Lobhudelei
6. Das Kompliment soll als Eisbrecher für eine Kaltakquise dienen
7. Erwähne KEINE Preise, Angebote oder Verkaufsabsichten
8. Schreibe NUR das Kompliment, keine Einleitung oder Erklärung
${customInstructions}

Schreibe jetzt das Kompliment:`;
}

/**
 * Generiert ein personalisiertes Kompliment für einen Lead
 */
export async function generateCompliment(
  lead: LeadData,
  apiKey: string,
  options: Partial<ComplimentOptions> = {},
  provider: AIProvider = "anthropic"
): Promise<GeneratedCompliment> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Validierung
  if (!apiKey) {
    throw new Error("API Key ist nicht konfiguriert");
  }

  if (!lead.company && !lead.website) {
    throw new Error("Mindestens Firmenname oder Website ist erforderlich");
  }

  const prompt = buildPrompt(lead, mergedOptions);

  try {
    const compliment = await generateText(prompt, apiKey, provider, 500);

    // Berechne Confidence basierend auf verfügbaren Daten
    let confidence = 0.5;
    if (lead.company) confidence += 0.1;
    if (lead.website) confidence += 0.15;
    if (lead.rating) confidence += 0.1;
    if (lead.reviews) confidence += 0.05;
    if (lead.category) confidence += 0.05;
    if (lead.description) confidence += 0.05;

    return {
      compliment,
      confidence: Math.min(confidence, 1),
      provider,
    };
  } catch (error) {
    // Provider-spezifische Fehlerbehandlung
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        throw new Error("Ungültiger Anthropic API-Key. Bitte überprüfe deine Einstellungen.");
      }
      if (error.status === 429) {
        throw new Error("Rate Limit erreicht. Bitte warte einen Moment und versuche es erneut.");
      }
      throw new Error(`Anthropic API-Fehler: ${error.message}`);
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        throw new Error("Ungültiger OpenAI API-Key. Bitte überprüfe deine Einstellungen.");
      }
      if (error.status === 429) {
        throw new Error("Rate Limit erreicht. Bitte warte einen Moment und versuche es erneut.");
      }
      throw new Error(`OpenAI API-Fehler: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Generiert Komplimente für mehrere Leads (Bulk)
 */
export async function generateComplimentsBulk(
  leads: Array<{ id: string; data: LeadData }>,
  apiKey: string,
  options: Partial<ComplimentOptions> = {},
  provider: AIProvider = "anthropic",
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<Map<string, GeneratedCompliment | { error: string }>> {
  const results = new Map<string, GeneratedCompliment | { error: string }>();

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const companyName = lead.data.company || lead.data.website || `Lead ${i + 1}`;

    if (onProgress) {
      onProgress(i, leads.length, companyName);
    }

    try {
      const result = await generateCompliment(lead.data, apiKey, options, provider);
      results.set(lead.id, result);
    } catch (error) {
      results.set(lead.id, {
        error: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }

    // Kleine Pause zwischen Anfragen um Rate Limiting zu vermeiden
    if (i < leads.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (onProgress) {
    onProgress(leads.length, leads.length, "Fertig");
  }

  return results;
}

/**
 * Preset-Konfigurationen für verschiedene Anwendungsfälle
 */
export const COMPLIMENT_PRESETS = {
  webdesign: {
    tone: "professional" as const,
    length: "medium" as const,
    language: "de" as const,
    focus: "website" as const,
    customInstructions: "Fokussiere auf das Design und die Benutzerfreundlichkeit der Website. Erwähne spezifische positive Aspekte die dir auffallen würden.",
  },
  restaurant: {
    tone: "friendly" as const,
    length: "medium" as const,
    language: "de" as const,
    focus: "reviews" as const,
    customInstructions: "Beziehe dich auf die positiven Bewertungen und das kulinarische Angebot.",
  },
  localBusiness: {
    tone: "friendly" as const,
    length: "short" as const,
    language: "de" as const,
    focus: "business" as const,
    customInstructions: "Betone die lokale Präsenz und den Service für die Gemeinschaft.",
  },
};
