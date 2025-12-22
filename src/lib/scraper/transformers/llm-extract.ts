/**
 * LLM-based Data Extraction Transformer
 * Uses OpenAI/Anthropic for intelligent data extraction with JSON Schema support
 */

import type {
  ExtractedContactData,
  ContactPerson,
} from '../types';

// LLM Provider types
type LLMProvider = 'openai' | 'anthropic' | 'ollama';

interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

interface ExtractionResult<T> {
  success: boolean;
  data?: T;
  confidence: number;
  error?: string;
}

/**
 * Extract structured data using LLM with JSON Schema
 */
export async function extractWithSchema<T>(
  content: string,
  schema: Record<string, unknown>,
  config: LLMConfig,
  systemPrompt?: string
): Promise<ExtractionResult<T>> {
  const prompt = buildSchemaExtractionPrompt(content, schema, systemPrompt);

  try {
    const response = await callLLM(prompt, config);
    const parsed = parseJsonResponse<T>(response);

    if (parsed) {
      return {
        success: true,
        data: parsed,
        confidence: 0.9,
      };
    }

    return {
      success: false,
      confidence: 0,
      error: 'Failed to parse LLM response as JSON',
    };
  } catch (error) {
    return {
      success: false,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract contact data from content (Impressum, Contact pages)
 * Optimized for German business websites
 */
export async function extractContactData(
  content: string,
  config: LLMConfig
): Promise<ExtractionResult<ExtractedContactData>> {
  const systemPrompt = `Du bist ein Experte für die Extraktion von Kontaktdaten aus deutschsprachigen Webseiten (Deutschland, Österreich, Schweiz).

WICHTIGE REGELN für Namen - LIES GENAU:

1. VORNAME = Nur ECHTE Vornamen wie: Stefan, Michael, Thomas, Anna, Sandra, Klaus, Peter, Bernhard, Adnan, Maria, Elisabeth
2. NACHNAME = Nur ECHTE Nachnamen wie: Schoder, Müller, Schmidt, Voigt, Meier, Suler, Hercegovac, Huber, Gruber

3. TITEL gehören NICHT in firstName/lastName! Diese Titel gehören in "position":
   - Akademisch: Dr., Prof., Mag., Dipl.-Ing., Dipl.-Kfm., LL.M., M.A., MBA, DI, Ing.
   - Beruflich: Rechtsanwalt, Notar, Steuerberater, Wirtschaftsprüfer, Geschäftsführer, Inhaber

4. BEISPIELE für korrekte Extraktion:
   - "Mag. Stefan Schoder" → firstName: "Stefan", lastName: "Schoder", position: "Mag."
   - "Dr. iur. Michael Fuß, LL.M." → firstName: "Michael", lastName: "Fuß", position: "Dr. iur., LL.M."
   - "Rechtsanwalt Thomas Gilsbach" → firstName: "Thomas", lastName: "Gilsbach", position: "Rechtsanwalt"
   - "Geschäftsführer: Herr Bernhard Suler, dipl." → firstName: "Bernhard", lastName: "Suler", position: "Geschäftsführer, dipl."
   - "Adnan Hercegovac (Staatlich geprüfter Versicherungsmakler)" → firstName: "Adnan", lastName: "Hercegovac", position: "Staatlich geprüfter Versicherungsmakler"
   - "Inhaber & Geschäftsführer: Herr Max Mustermann" → firstName: "Max", lastName: "Mustermann", position: "Inhaber & Geschäftsführer"

5. FALSCH - Diese sind KEINE Namen:
   - UI-Texte: "Füllen", "Sie", "Ihr", "Bitte", "Hier", "Kontakt", "Anfrage", "Name", "E-Mail"
   - Berufe ohne Person: "Rechtsanwalt" (allein), "Der Geschäftsführer" (ohne Name)
   - Firmennamen: "GmbH", "AG", "KG", "e.U."

6. WICHTIG: Wenn KEINE echte Person mit erkennbarem Vor- UND Nachname gefunden wird, gib contactPersons: [] zurück!
   Erfinde NIEMALS Namen! Lieber leer lassen als falsch!

REGELN für E-Mails:
1. "This email address is being protected from spambots" = E-Mail JavaScript-geschützt → leeres Array
2. Akzeptiere auch info@, office@, kontakt@ wenn keine persönlichen E-Mails verfügbar
3. Priorisiere persönliche E-Mails (vorname.nachname@) vor generischen

Antworte NUR mit validem JSON. Kein zusätzlicher Text.
Nicht gefundene Felder = leeres Array [] oder null.`;

  const schema = {
    type: 'object',
    properties: {
      emails: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alle gefundenen E-Mail-Adressen',
      },
      phones: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alle Telefonnummern (formatiert)',
      },
      addresses: {
        type: 'array',
        items: { type: 'string' },
        description: 'Vollständige Adressen',
      },
      contactPersons: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            firstName: { type: 'string', description: 'NUR der reine Vorname ohne Titel. Beispiel: Bei "Mag. Stefan Schoder" → "Stefan"' },
            lastName: { type: 'string', description: 'NUR der reine Nachname. Beispiel: Bei "Mag. Stefan Schoder" → "Schoder"' },
            name: { type: 'string', description: 'Voller Name NUR falls firstName/lastName absolut nicht trennbar' },
            position: { type: 'string', description: 'ALLE Titel und Berufsbezeichnungen hier! Z.B. "Mag.", "Dr. iur., Rechtsanwalt", "Geschäftsführer"' },
            email: { type: 'string' },
            phone: { type: 'string' },
          },
        },
        description: 'Echte Personen mit Vor- UND Nachname. Titel wie Dr./Mag./Prof. gehören in position, NICHT in firstName!',
      },
      socialLinks: {
        type: 'object',
        properties: {
          linkedin: { type: 'string' },
          twitter: { type: 'string' },
          facebook: { type: 'string' },
          instagram: { type: 'string' },
          xing: { type: 'string' },
        },
      },
      companyName: { type: 'string' },
      vatId: { type: 'string', description: 'USt-IdNr.' },
      registrationNumber: { type: 'string', description: 'Handelsregisternummer' },
    },
    required: ['emails', 'phones', 'addresses', 'contactPersons', 'socialLinks'],
  };

  return extractWithSchema<ExtractedContactData>(
    content,
    schema,
    config,
    systemPrompt
  );
}

/**
 * Extract data with natural language prompt (no schema)
 */
export async function extractWithPrompt(
  content: string,
  prompt: string,
  config: LLMConfig
): Promise<ExtractionResult<unknown>> {
  const fullPrompt = `${prompt}

Content to analyze:
---
${content.substring(0, 15000)}
---

Respond with a JSON object containing the extracted information.`;

  try {
    const response = await callLLM(fullPrompt, config);
    const parsed = parseJsonResponse(response);

    return {
      success: parsed !== null,
      data: parsed,
      confidence: parsed ? 0.85 : 0,
      error: parsed ? undefined : 'Failed to parse response',
    };
  } catch (error) {
    return {
      success: false,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build prompt for schema-based extraction
 */
function buildSchemaExtractionPrompt(
  content: string,
  schema: Record<string, unknown>,
  systemPrompt?: string
): string {
  const defaultSystem = `Extract information from the provided content according to the JSON schema.
Return ONLY a valid JSON object matching the schema. No explanations or additional text.`;

  return `${systemPrompt || defaultSystem}

JSON Schema:
${JSON.stringify(schema, null, 2)}

Content to extract from:
---
${content.substring(0, 15000)}
---

Return the extracted data as a JSON object:`;
}

/**
 * Call LLM API based on provider
 */
async function callLLM(prompt: string, config: LLMConfig): Promise<string> {
  switch (config.provider) {
    case 'openai':
      return callOpenAI(prompt, config);
    case 'anthropic':
      return callAnthropic(prompt, config);
    case 'ollama':
      return callOllama(prompt, config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Call OpenAI API
 * NOTE: Only uses user-provided API key, NO server fallback for security/cost reasons
 */
async function callOpenAI(prompt: string, config: LLMConfig): Promise<string> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured - each user must provide their own API key');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic API
 * NOTE: Only uses user-provided API key, NO server fallback for security/cost reasons
 */
async function callAnthropic(prompt: string, config: LLMConfig): Promise<string> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error('Anthropic API key not configured - each user must provide their own API key');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

/**
 * Call Ollama API (local)
 */
async function callOllama(prompt: string, config: LLMConfig): Promise<string> {
  const baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'llama2',
      prompt,
      stream: false,
      format: 'json',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${error}`);
  }

  const data = await response.json();
  return data.response || '';
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJsonResponse<T>(response: string): T | null {
  // Try direct parse
  try {
    return JSON.parse(response);
  } catch {
    // Continue to other methods
  }

  // Try extracting from markdown code block
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {
      // Continue to other methods
    }
  }

  // Try finding JSON object in response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Failed all attempts
    }
  }

  return null;
}

/**
 * Extract emails using regex (fallback without LLM)
 */
export function extractEmailsRegex(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return [...new Set(matches)];
}

/**
 * Extract phone numbers using regex (fallback without LLM)
 */
export function extractPhonesRegex(text: string): string[] {
  // German phone number patterns
  const phoneRegex =
    /(?:\+49|0049|0)\s*[\d\s\-\/\(\)]{8,20}|\+\d{1,3}\s*[\d\s\-\/\(\)]{8,20}/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches.map((p) => p.replace(/\s+/g, ' ').trim()))];
}

/**
 * Fallback contact extraction without LLM (regex-based)
 */
export function extractContactDataFallback(text: string): ExtractedContactData {
  return {
    emails: extractEmailsRegex(text),
    phones: extractPhonesRegex(text),
    addresses: [],
    contactPersons: [],
    socialLinks: {
      linkedin: extractSocialLink(text, 'linkedin'),
      twitter: extractSocialLink(text, 'twitter'),
      facebook: extractSocialLink(text, 'facebook'),
      instagram: extractSocialLink(text, 'instagram'),
      xing: extractSocialLink(text, 'xing'),
    },
  };
}

/**
 * Extract social media link
 */
function extractSocialLink(
  text: string,
  platform: string
): string | undefined {
  const patterns: Record<string, RegExp> = {
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>]+/i,
    twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s"'<>]+/i,
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i,
    xing: /https?:\/\/(?:www\.)?xing\.com\/(?:companies|profile)\/[^\s"'<>]+/i,
  };

  const match = text.match(patterns[platform]);
  return match ? match[0] : undefined;
}
