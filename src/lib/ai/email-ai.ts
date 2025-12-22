/**
 * AI-powered Email Features
 *
 * - Email Writer: Generate cold emails from prompts
 * - Spintax Generator: Create variations of emails
 * - Spam Checker: Analyze emails for spam triggers
 * - Reply Suggestions: Generate smart reply suggestions
 */

import { generateText, AIProvider } from "./providers";

// ============================================
// Types
// ============================================

export interface EmailWriterInput {
  purpose: string;           // "Kaltakquise für SaaS Produkt"
  targetAudience: string;    // "CEOs von mittelständischen Unternehmen"
  tone: "formal" | "casual" | "friendly" | "professional";
  keyPoints?: string[];      // ["USP 1", "USP 2"]
  callToAction: string;      // "Termin vereinbaren"
  language?: string;         // "de" | "en"
  maxLength?: "short" | "medium" | "long";
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  previewText?: string;
}

export interface SpamCheckResult {
  score: number;             // 0-100 (0 = safe, 100 = definitely spam)
  rating: "safe" | "caution" | "warning" | "danger";
  issues: SpamIssue[];
  suggestions: string[];
}

export interface SpamIssue {
  type: "word" | "formatting" | "structure" | "link" | "personalization";
  description: string;
  severity: "low" | "medium" | "high";
  location?: string;
}

export interface ReplySuggestion {
  type: "interested" | "meeting" | "more_info" | "decline" | "follow_up";
  subject?: string;
  body: string;
  tone: string;
}

// ============================================
// Email Writer
// ============================================

export async function generateEmail(
  input: EmailWriterInput,
  apiKey: string,
  provider: AIProvider = "anthropic"
): Promise<GeneratedEmail> {
  const language = input.language || "de";
  const maxLength = input.maxLength || "medium";

  const lengthGuide = {
    short: "maximal 80 Wörter",
    medium: "100-150 Wörter",
    long: "150-200 Wörter"
  };

  const toneGuide = {
    formal: "förmlich und respektvoll",
    casual: "locker und persönlich",
    friendly: "freundlich und warmherzig",
    professional: "professionell aber nahbar"
  };

  const prompt = `Du bist ein Experte für Kaltakquise-E-Mails im DACH-Raum.

Erstelle eine überzeugende ${language === "de" ? "deutsche" : "englische"} E-Mail.

ANFORDERUNGEN:
- Zweck: ${input.purpose}
- Zielgruppe: ${input.targetAudience}
- Tonalität: ${toneGuide[input.tone]}
- Call-to-Action: ${input.callToAction}
- Länge: ${lengthGuide[maxLength]}
${input.keyPoints?.length ? `- Kernpunkte: ${input.keyPoints.join(", ")}` : ""}

REGELN:
1. Personalisierbar mit {{firstName}}, {{lastName}}, {{company}}
2. Keine Spam-Wörter (GRATIS, KOSTENLOS, DRINGEND, !!!, €€€)
3. Kurzer, neugierig machender Betreff (max 50 Zeichen)
4. Starker Einstieg ohne "Ich hoffe, diese E-Mail findet Sie..."
5. Klarer Mehrwert für den Empfänger
6. Ein einziger, klarer Call-to-Action
7. Professionelle Signatur-Platzhalter am Ende

Antworte NUR mit einem validen JSON-Objekt (keine Markdown-Formatierung):
{"subject": "Betreffzeile", "body": "E-Mail Text mit HTML-Formatierung (<p>, <br>, <b>)", "previewText": "Vorschautext für E-Mail-Client (max 100 Zeichen)"}`;

  const response = await generateText(prompt, apiKey, provider, 1500);

  try {
    // Clean response - remove markdown code blocks if present
    const cleanedResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleanedResponse);
    return {
      subject: result.subject || "",
      body: result.body || "",
      previewText: result.previewText || "",
    };
  } catch (error) {
    console.error("Failed to parse email generation response:", response);
    throw new Error("KI-Antwort konnte nicht verarbeitet werden");
  }
}

// ============================================
// Spintax Generator
// ============================================

export async function generateSpintax(
  emailBody: string,
  apiKey: string,
  provider: AIProvider = "anthropic",
  variationLevel: "light" | "moderate" | "heavy" = "moderate"
): Promise<string> {
  const variationGuide = {
    light: "2-3 Spintax-Blöcke, nur Grußformeln und Übergänge",
    moderate: "4-6 Spintax-Blöcke, auch Adjektive und Phrasen",
    heavy: "7-10 Spintax-Blöcke, umfangreiche Variationen"
  };

  const prompt = `Du bist ein Experte für E-Mail-Personalisierung mit Spintax.

ORIGINAL E-MAIL:
${emailBody}

AUFGABE:
Füge Spintax-Variationen ein: ${variationGuide[variationLevel]}

SPINTAX-SYNTAX:
{Option1|Option2|Option3}

BEISPIELE:
- Grußformeln: {Hallo|Guten Tag|Hi} {{firstName}}
- Übergänge: {Ich wollte|Ich möchte|Gerne würde ich}
- Adjektive: {interessante|spannende|vielversprechende}
- Abschlüsse: {Beste Grüße|Mit freundlichen Grüßen|Viele Grüße}

REGELN:
1. Kernbotschaft und Struktur beibehalten
2. Variationen müssen grammatikalisch korrekt sein
3. Keine Spintax in {{variablen}} einfügen
4. Jede Option muss sinnvoll sein
5. HTML-Tags nicht verändern

Antworte NUR mit der modifizierten E-Mail (kein JSON, keine Erklärung).`;

  const response = await generateText(prompt, apiKey, provider, 2000);
  return response.trim();
}

// ============================================
// Spam Checker
// ============================================

export async function checkSpam(
  subject: string,
  body: string,
  apiKey: string,
  provider: AIProvider = "anthropic"
): Promise<SpamCheckResult> {
  const prompt = `Du bist ein E-Mail-Zustellbarkeits-Experte. Analysiere diese E-Mail auf Spam-Risiken.

BETREFF:
${subject}

INHALT:
${body}

PRÜFE AUF:
1. Spam-Trigger-Wörter (GRATIS, KOSTENLOS, DRINGEND, Gewinn, €, $, !!!)
2. Übermäßige Großschreibung (> 20% des Textes)
3. Zu viele Links (> 3)
4. Fehlende Personalisierung (kein {{firstName}}, {{company}})
5. Aggressive Verkaufssprache
6. Formatierungsprobleme (zu viele Farben, große Schriften)
7. Verdächtige Phrasen ("begrenzte Zeit", "nur heute", "sofort handeln")
8. Link-zu-Text-Verhältnis
9. Fehlender Abmeldelink-Hinweis
10. Zu lange Betreffzeile (> 60 Zeichen)

BEWERTUNG:
- 0-25: safe (grün) - Sehr gute Zustellbarkeit
- 26-50: caution (gelb) - Kleine Verbesserungen möglich
- 51-75: warning (orange) - Überarbeitung empfohlen
- 76-100: danger (rot) - Hohe Spam-Wahrscheinlichkeit

Antworte NUR mit einem validen JSON-Objekt:
{
  "score": 0-100,
  "rating": "safe|caution|warning|danger",
  "issues": [
    {"type": "word|formatting|structure|link|personalization", "description": "Problem", "severity": "low|medium|high", "location": "optional"}
  ],
  "suggestions": ["Verbesserungsvorschlag 1", "Verbesserungsvorschlag 2"]
}`;

  const response = await generateText(prompt, apiKey, provider, 1500);

  try {
    const cleanedResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleanedResponse);
    return {
      score: Math.min(100, Math.max(0, result.score || 0)),
      rating: result.rating || "caution",
      issues: result.issues || [],
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    console.error("Failed to parse spam check response:", response);
    throw new Error("Spam-Analyse konnte nicht verarbeitet werden");
  }
}

// ============================================
// Reply Suggestions
// ============================================

export async function generateReplySuggestions(
  originalEmail: string,
  replyEmail: string,
  replyIntent: string | null,
  context: {
    recipientName?: string;
    company?: string;
    campaignName?: string;
  },
  apiKey: string,
  provider: AIProvider = "anthropic"
): Promise<ReplySuggestion[]> {
  const prompt = `Du bist ein Vertriebsexperte für E-Mail-Kommunikation.

URSPRÜNGLICHE E-MAIL (von uns gesendet):
${originalEmail}

ANTWORT DES EMPFÄNGERS:
${replyEmail}

ERKANNTER INTENT: ${replyIntent || "unbekannt"}

KONTEXT:
- Empfänger: ${context.recipientName || "Unbekannt"}
- Unternehmen: ${context.company || "Unbekannt"}
- Kampagne: ${context.campaignName || "Unbekannt"}

AUFGABE:
Erstelle 3 verschiedene Antwortvorschläge passend zum Intent des Empfängers.

TYPEN:
- interested: Interesse weiter ausbauen, Mehrwert betonen
- meeting: Konkret Termin vorschlagen
- more_info: Zusätzliche Informationen bereitstellen
- decline: Höflich verabschieden, Tür offen lassen
- follow_up: Nachfassen, erneut Interesse wecken

REGELN:
1. Kurz und prägnant (max 100 Wörter pro Antwort)
2. Personalisiert mit Namen
3. Passend zum Intent
4. Professionell aber freundlich
5. Klarer nächster Schritt

Antworte NUR mit einem validen JSON-Array:
[
  {"type": "interested|meeting|more_info|decline|follow_up", "subject": "Re: Original Betreff", "body": "Antworttext", "tone": "kurze Beschreibung des Tons"},
  ...
]`;

  const response = await generateText(prompt, apiKey, provider, 2000);

  try {
    const cleanedResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleanedResponse);
    if (!Array.isArray(result)) {
      throw new Error("Expected array");
    }
    return result.slice(0, 3); // Max 3 suggestions
  } catch (error) {
    console.error("Failed to parse reply suggestions:", response);
    throw new Error("Antwortvorschläge konnten nicht generiert werden");
  }
}

// ============================================
// Subject Line Generator
// ============================================

export async function generateSubjectLines(
  emailBody: string,
  count: number = 5,
  apiKey: string,
  provider: AIProvider = "anthropic"
): Promise<string[]> {
  const prompt = `Du bist ein Experte für E-Mail-Betreffzeilen mit hohen Öffnungsraten.

E-MAIL INHALT:
${emailBody}

AUFGABE:
Generiere ${count} verschiedene Betreffzeilen für diese E-Mail.

REGELN:
1. Maximal 50 Zeichen (für mobile Geräte)
2. Keine Spam-Wörter
3. Neugier wecken ohne Clickbait
4. Personalisierung mit {{firstName}} oder {{company}} möglich
5. Verschiedene Stile: Frage, Aussage, Personalisiert, Nutzen-fokussiert

Antworte NUR mit einem JSON-Array von Strings:
["Betreff 1", "Betreff 2", ...]`;

  const response = await generateText(prompt, apiKey, provider, 500);

  try {
    const cleanedResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleanedResponse);
    if (!Array.isArray(result)) {
      throw new Error("Expected array");
    }
    return result.slice(0, count);
  } catch (error) {
    console.error("Failed to parse subject lines:", response);
    throw new Error("Betreffzeilen konnten nicht generiert werden");
  }
}

// ============================================
// Email Improver
// ============================================

export async function improveEmail(
  subject: string,
  body: string,
  improvements: ("clarity" | "persuasion" | "personalization" | "brevity" | "cta")[],
  apiKey: string,
  provider: AIProvider = "anthropic"
): Promise<GeneratedEmail> {
  const improvementDescriptions = {
    clarity: "Klarheit und Verständlichkeit verbessern",
    persuasion: "Überzeugungskraft und Nutzenargumentation stärken",
    personalization: "Mehr Personalisierungsmöglichkeiten einbauen",
    brevity: "Kürzer und prägnanter formulieren",
    cta: "Call-to-Action klarer und überzeugender gestalten"
  };

  const selectedImprovements = improvements
    .map(i => improvementDescriptions[i])
    .join("\n- ");

  const prompt = `Du bist ein Experte für E-Mail-Optimierung.

AKTUELLE E-MAIL:

Betreff: ${subject}

${body}

GEWÜNSCHTE VERBESSERUNGEN:
- ${selectedImprovements}

AUFGABE:
Überarbeite die E-Mail entsprechend der gewünschten Verbesserungen.

REGELN:
1. Kernbotschaft beibehalten
2. Bestehende Personalisierungsvariablen ({{...}}) erhalten
3. Keine neuen Spam-Trigger einführen
4. HTML-Struktur beibehalten

Antworte NUR mit einem validen JSON-Objekt:
{"subject": "Verbesserter Betreff", "body": "Verbesserter E-Mail-Text"}`;

  const response = await generateText(prompt, apiKey, provider, 1500);

  try {
    const cleanedResponse = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleanedResponse);
    return {
      subject: result.subject || subject,
      body: result.body || body,
    };
  } catch (error) {
    console.error("Failed to parse improved email:", response);
    throw new Error("E-Mail-Verbesserung konnte nicht verarbeitet werden");
  }
}
