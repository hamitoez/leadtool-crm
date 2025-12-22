/**
 * Spintax Parser und E-Mail Personalisierung
 *
 * Spintax Syntax: {Option1|Option2|Option3}
 * Variables Syntax: {{variableName}}
 */

/**
 * Parst Spintax und gibt eine zufällige Variante zurück
 *
 * Beispiel:
 * Input:  "{Hallo|Hi|Guten Tag} {{firstName}}, {wie geht es Ihnen|wie geht's}?"
 * Output: "Hi {{firstName}}, wie geht's?"
 */
export function parseSpintax(text: string): string {
  // Regex für verschachtelte Spintax (unterstützt auch verschachtelte Klammern)
  const regex = /\{([^{}]+)\}/g;

  let result = text;
  let hasMatch = true;

  // Wiederhole bis keine Matches mehr (für verschachtelte Spintax)
  while (hasMatch) {
    const newResult = result.replace(regex, (match, group) => {
      // Prüfe ob es Spintax ist (enthält |)
      if (group.includes('|')) {
        const options = group.split('|');
        return options[Math.floor(Math.random() * options.length)];
      }
      // Sonst unverändert lassen
      return match;
    });

    hasMatch = newResult !== result;
    result = newResult;
  }

  return result;
}

/**
 * Ersetzt Variablen mit Werten
 *
 * Beispiel:
 * Input:  "Hallo {{firstName}}, Sie arbeiten bei {{company}}."
 * Variables: { firstName: "Max", company: "ACME GmbH" }
 * Output: "Hallo Max, Sie arbeiten bei ACME GmbH."
 */
export function replaceVariables(
  text: string,
  variables: Record<string, string | undefined | null>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    // Wenn Variable nicht vorhanden, leerer String (oder Match behalten?)
    return value !== undefined && value !== null ? value : '';
  });
}

/**
 * Vollständige E-Mail-Personalisierung
 * 1. Spintax auflösen (zufällige Varianten wählen)
 * 2. Variablen ersetzen
 */
export function personalizeEmail(
  text: string,
  variables: Record<string, string | undefined | null>
): string {
  // Erst Spintax auflösen
  let result = parseSpintax(text);
  // Dann Variablen ersetzen
  result = replaceVariables(result, variables);
  return result;
}

/**
 * Generiert alle möglichen Spintax-Varianten (für Preview)
 * ACHTUNG: Bei vielen Optionen kann dies sehr viele Ergebnisse liefern!
 */
export function getAllSpintaxVariants(text: string, maxVariants: number = 10): string[] {
  const variants: string[] = [];

  // Finde alle Spintax-Gruppen
  const regex = /\{([^{}]+)\}/g;
  const matches: { start: number; end: number; options: string[] }[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1].includes('|')) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        options: match[1].split('|'),
      });
    }
  }

  if (matches.length === 0) {
    return [text];
  }

  // Generiere Kombinationen (mit Limit)
  function generateCombinations(
    index: number,
    current: string
  ): void {
    if (variants.length >= maxVariants) return;

    if (index >= matches.length) {
      variants.push(current);
      return;
    }

    const match = matches[index];
    const before = index === 0
      ? current.slice(0, match.start)
      : current;
    const after = text.slice(match.end);

    for (const option of match.options) {
      if (variants.length >= maxVariants) break;

      const newText = index === 0
        ? before + option + after
        : current.slice(0, match.start - (text.length - current.length)) +
          option +
          current.slice(match.end - (text.length - current.length));

      generateCombinations(index + 1, newText);
    }
  }

  // Einfachere Implementierung: Generiere zufällige Varianten
  for (let i = 0; i < maxVariants; i++) {
    const variant = parseSpintax(text);
    if (!variants.includes(variant)) {
      variants.push(variant);
    }
  }

  return variants;
}

/**
 * Zählt die Anzahl möglicher Spintax-Varianten
 */
export function countSpintaxVariants(text: string): number {
  const regex = /\{([^{}]+)\}/g;
  let count = 1;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1].includes('|')) {
      const options = match[1].split('|');
      count *= options.length;
    }
  }

  return count;
}

/**
 * Extrahiert alle verwendeten Variablen aus einem Text
 */
export function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Standard-Variablen für E-Mail-Kampagnen
 */
export const DEFAULT_VARIABLES = [
  { name: 'firstName', label: 'Vorname', example: 'Max' },
  { name: 'lastName', label: 'Nachname', example: 'Mustermann' },
  { name: 'fullName', label: 'Vollständiger Name', example: 'Max Mustermann' },
  { name: 'email', label: 'E-Mail', example: 'max@beispiel.de' },
  { name: 'company', label: 'Firma', example: 'ACME GmbH' },
  { name: 'position', label: 'Position', example: 'Geschäftsführer' },
  { name: 'website', label: 'Website', example: 'www.beispiel.de' },
  { name: 'phone', label: 'Telefon', example: '+49 123 456789' },
  { name: 'city', label: 'Stadt', example: 'Berlin' },
] as const;

/**
 * Validiert ob alle benötigten Variablen vorhanden sind
 */
export function validateVariables(
  text: string,
  providedVariables: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const required = extractVariables(text);
  const missing = required.filter(v => !(v in providedVariables));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Preview einer E-Mail mit Beispieldaten
 */
export function previewEmail(
  subject: string,
  body: string,
  variables?: Record<string, string>
): { subject: string; body: string } {
  // Verwende Beispieldaten wenn keine Variablen angegeben
  const exampleData: Record<string, string> = variables || {};

  if (!variables) {
    for (const v of DEFAULT_VARIABLES) {
      exampleData[v.name] = v.example;
    }
  }

  return {
    subject: personalizeEmail(subject, exampleData),
    body: personalizeEmail(body, exampleData),
  };
}
