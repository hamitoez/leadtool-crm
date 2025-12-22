/**
 * AI-Powered Reply Intent Analyzer
 *
 * Categorizes email replies using LLM to detect:
 * - INTERESTED: Lead shows interest, wants more info
 * - NOT_INTERESTED: Lead declines, not interested
 * - MEETING_REQUEST: Lead wants to schedule a meeting/call
 * - OOO: Out of office / auto-reply
 * - QUESTION: Lead has questions, needs clarification
 * - UNSUBSCRIBE: Lead wants to be removed from list
 * - BOUNCE: Delivery failure (handled separately)
 * - UNKNOWN: Cannot determine intent
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import prisma from "@/lib/prisma";

// Reply intent categories
export type ReplyIntent =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "MEETING_REQUEST"
  | "OOO"
  | "QUESTION"
  | "UNSUBSCRIBE"
  | "BOUNCE"
  | "UNKNOWN";

export interface ReplyAnalysisResult {
  intent: ReplyIntent;
  confidence: number; // 0.0 - 1.0
  summary: string; // Brief summary of the reply
  reasoning?: string; // Why this intent was detected
}

// Quick pattern matching for common cases (faster than LLM)
const QUICK_PATTERNS: Array<{
  pattern: RegExp;
  intent: ReplyIntent;
  confidence: number;
}> = [
  // Out of Office patterns (German & English)
  { pattern: /außer (haus|büro|office)/i, intent: "OOO", confidence: 0.95 },
  { pattern: /out of (office|the office)/i, intent: "OOO", confidence: 0.95 },
  { pattern: /abwesen(d|heit)/i, intent: "OOO", confidence: 0.95 },
  { pattern: /auto(-|\s)?reply|automatische antwort/i, intent: "OOO", confidence: 0.95 },
  { pattern: /ich bin (derzeit |momentan |aktuell )?nicht (erreichbar|im büro|verfügbar)/i, intent: "OOO", confidence: 0.9 },
  { pattern: /im urlaub|on vacation|on holiday/i, intent: "OOO", confidence: 0.9 },

  // Unsubscribe patterns
  { pattern: /unsubscribe|abmelden|austragen|abbestellen/i, intent: "UNSUBSCRIBE", confidence: 0.95 },
  { pattern: /remove (me |my email )?from (your |this )?list/i, intent: "UNSUBSCRIBE", confidence: 0.95 },
  { pattern: /keine (weiteren )?e-?mails/i, intent: "UNSUBSCRIBE", confidence: 0.9 },
  { pattern: /stop (sending|emailing|contacting)/i, intent: "UNSUBSCRIBE", confidence: 0.9 },

  // Not interested patterns
  { pattern: /kein interesse|not interested|no interest/i, intent: "NOT_INTERESTED", confidence: 0.9 },
  { pattern: /danke,? (aber )?nein/i, intent: "NOT_INTERESTED", confidence: 0.85 },
  { pattern: /no,? thank(s| you)/i, intent: "NOT_INTERESTED", confidence: 0.85 },
  { pattern: /aktuell kein(e)? (bedarf|interesse)/i, intent: "NOT_INTERESTED", confidence: 0.85 },

  // Meeting request patterns
  { pattern: /termin (vereinbaren|ausmachen|finden)/i, intent: "MEETING_REQUEST", confidence: 0.9 },
  { pattern: /let'?s (schedule|set up|book) a (call|meeting)/i, intent: "MEETING_REQUEST", confidence: 0.9 },
  { pattern: /wann (hätten Sie|hättest du|passt|können)/i, intent: "MEETING_REQUEST", confidence: 0.8 },
  { pattern: /telefonat|gespräch|call.*schedule|meeting.*book/i, intent: "MEETING_REQUEST", confidence: 0.8 },

  // Interested patterns
  { pattern: /sehr interessant|sounds (great|interesting)|klingt (gut|interessant)/i, intent: "INTERESTED", confidence: 0.8 },
  { pattern: /tell me more|mehr (erfahren|informationen|details)/i, intent: "INTERESTED", confidence: 0.85 },
  { pattern: /ja,? gerne|yes,? please/i, intent: "INTERESTED", confidence: 0.8 },

  // Bounce patterns
  { pattern: /delivery (failed|failure|status notification)/i, intent: "BOUNCE", confidence: 0.95 },
  { pattern: /undeliverable|nicht zustellbar|mailer-daemon/i, intent: "BOUNCE", confidence: 0.95 },
  { pattern: /mailbox (full|not found|unavailable)/i, intent: "BOUNCE", confidence: 0.95 },
];

/**
 * Analyze reply intent using quick patterns first, then LLM if needed
 */
export async function analyzeReplyIntent(
  replyText: string,
  subject?: string
): Promise<ReplyAnalysisResult> {
  // Normalize text
  const normalizedText = replyText.trim().toLowerCase();
  const fullText = subject ? `${subject}\n${replyText}` : replyText;

  // Try quick pattern matching first (faster)
  for (const { pattern, intent, confidence } of QUICK_PATTERNS) {
    if (pattern.test(fullText)) {
      return {
        intent,
        confidence,
        summary: generateQuickSummary(intent, replyText),
        reasoning: "Pattern-based detection",
      };
    }
  }

  // For complex cases, use LLM
  try {
    return await analyzeWithLLM(replyText, subject);
  } catch (error) {
    console.error("[Reply Analyzer] LLM error, using fallback:", error);
    return {
      intent: "UNKNOWN",
      confidence: 0.5,
      summary: "Antwort konnte nicht analysiert werden",
      reasoning: "LLM analysis failed",
    };
  }
}

/**
 * Generate a quick summary for pattern-matched intents
 */
function generateQuickSummary(intent: ReplyIntent, text: string): string {
  const preview = text.substring(0, 100).replace(/\n/g, " ");

  switch (intent) {
    case "OOO":
      return "Automatische Abwesenheitsbenachrichtigung";
    case "UNSUBSCRIBE":
      return "Möchte keine weiteren E-Mails erhalten";
    case "NOT_INTERESTED":
      return "Aktuell kein Interesse";
    case "MEETING_REQUEST":
      return "Möchte einen Termin vereinbaren";
    case "INTERESTED":
      return "Zeigt Interesse";
    case "BOUNCE":
      return "E-Mail konnte nicht zugestellt werden";
    default:
      return preview + (text.length > 100 ? "..." : "");
  }
}

/**
 * Analyze reply using LLM (Anthropic Claude)
 */
async function analyzeWithLLM(
  replyText: string,
  subject?: string
): Promise<ReplyAnalysisResult> {
  // Get AI settings from system or use defaults
  const settings = await prisma.userSettings.findFirst({
    where: {
      aiApiKey: { not: null },
    },
    select: {
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
    },
  });

  // Use environment API key if no user settings
  const apiKey = settings?.aiApiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  const provider = settings?.aiProvider || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");

  if (!apiKey) {
    throw new Error("No AI API key configured");
  }

  const prompt = buildAnalysisPrompt(replyText, subject);

  if (provider === "anthropic") {
    return analyzeWithAnthropic(apiKey, prompt);
  } else {
    return analyzeWithOpenAI(apiKey, prompt, settings?.aiModel);
  }
}

/**
 * Build the analysis prompt
 */
function buildAnalysisPrompt(replyText: string, subject?: string): string {
  return `Analysiere die folgende E-Mail-Antwort und bestimme die Absicht des Absenders.

${subject ? `BETREFF: ${subject}\n` : ""}
E-MAIL-TEXT:
${replyText.substring(0, 2000)}

Kategorisiere die Antwort in EINE der folgenden Kategorien:
- INTERESTED: Der Absender zeigt Interesse und möchte mehr erfahren
- NOT_INTERESTED: Der Absender lehnt ab oder hat kein Interesse
- MEETING_REQUEST: Der Absender möchte einen Termin oder ein Gespräch vereinbaren
- OOO: Abwesenheitsnotiz / Automatische Antwort
- QUESTION: Der Absender hat Fragen oder braucht mehr Informationen
- UNSUBSCRIBE: Der Absender möchte keine weiteren E-Mails erhalten
- UNKNOWN: Die Absicht ist nicht klar erkennbar

Antworte im JSON-Format:
{
  "intent": "KATEGORIE",
  "confidence": 0.0-1.0,
  "summary": "Kurze Zusammenfassung der Antwort (max 100 Zeichen)",
  "reasoning": "Kurze Begründung für die Kategorisierung"
}`;
}

/**
 * Analyze with Anthropic Claude
 */
async function analyzeWithAnthropic(
  apiKey: string,
  prompt: string
): Promise<ReplyAnalysisResult> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return parseAnalysisResponse(content.text);
}

/**
 * Analyze with OpenAI
 */
async function analyzeWithOpenAI(
  apiKey: string,
  prompt: string,
  model?: string | null
): Promise<ReplyAnalysisResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: model || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  return parseAnalysisResponse(content);
}

/**
 * Parse LLM response into ReplyAnalysisResult
 */
function parseAnalysisResponse(response: string): ReplyAnalysisResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate intent
    const validIntents: ReplyIntent[] = [
      "INTERESTED",
      "NOT_INTERESTED",
      "MEETING_REQUEST",
      "OOO",
      "QUESTION",
      "UNSUBSCRIBE",
      "BOUNCE",
      "UNKNOWN",
    ];

    const intent = validIntents.includes(parsed.intent) ? parsed.intent : "UNKNOWN";
    const confidence = Math.min(1, Math.max(0, parseFloat(parsed.confidence) || 0.5));

    return {
      intent,
      confidence,
      summary: parsed.summary?.substring(0, 200) || "Keine Zusammenfassung",
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error("[Reply Analyzer] Failed to parse response:", error);
    return {
      intent: "UNKNOWN",
      confidence: 0.5,
      summary: "Analyse fehlgeschlagen",
      reasoning: "Parse error",
    };
  }
}

/**
 * Batch analyze multiple replies (for migration/import)
 */
export async function batchAnalyzeReplies(
  replies: Array<{ id: string; text: string; subject?: string }>
): Promise<Map<string, ReplyAnalysisResult>> {
  const results = new Map<string, ReplyAnalysisResult>();

  for (const reply of replies) {
    const analysis = await analyzeReplyIntent(reply.text, reply.subject);
    results.set(reply.id, analysis);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
