import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  generateCompliment,
  generateComplimentsBulk,
  ComplimentOptions,
  COMPLIMENT_PRESETS,
  AIProvider,
} from "@/lib/ai/compliment-generator";
import prisma from "@/lib/prisma";
import { getUserAISettings } from "@/lib/user-settings";

// Validation Schema für einzelne Anfrage
const singleRequestSchema = z.object({
  leadData: z.object({
    company: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    website: z.string().optional(),
    rating: z.number().optional(),
    reviews: z.number().optional(),
    reviewKeywords: z.string().optional(),
    reviewText: z.string().optional(), // JSON-komprimierte Review-Texte
    category: z.string().optional(),
    address: z.string().optional(),
    description: z.string().optional(),
  }),
  options: z.object({
    tone: z.enum(["professional", "friendly", "casual"]).optional(),
    length: z.enum(["short", "medium", "long"]).optional(),
    language: z.enum(["de", "en"]).optional(),
    focus: z.enum(["website", "reviews", "business", "general"]).optional(),
    customInstructions: z.string().optional(),
    preset: z.enum(["webdesign", "restaurant", "localBusiness"]).optional(),
  }).optional(),
  // Optional: Cell ID zum direkten Speichern
  cellId: z.string().optional(),
});

// Validation Schema für Bulk-Anfrage
const bulkRequestSchema = z.object({
  leads: z.array(z.object({
    id: z.string(),
    cellId: z.string().optional(),
    data: z.object({
      company: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      website: z.string().optional(),
      rating: z.number().optional(),
      reviews: z.number().optional(),
      reviewKeywords: z.string().optional(),
      reviewText: z.string().optional(), // JSON-komprimierte Review-Texte
      category: z.string().optional(),
      address: z.string().optional(),
      description: z.string().optional(),
    }),
  })),
  options: z.object({
    tone: z.enum(["professional", "friendly", "casual"]).optional(),
    length: z.enum(["short", "medium", "long"]).optional(),
    language: z.enum(["de", "en"]).optional(),
    focus: z.enum(["website", "reviews", "business", "general"]).optional(),
    customInstructions: z.string().optional(),
    preset: z.enum(["webdesign", "restaurant", "localBusiness"]).optional(),
  }).optional(),
});

/**
 * POST /api/ai/generate-compliment
 * Generiert ein personalisiertes Kompliment für einen Lead
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Prüfe ob es eine Bulk-Anfrage ist
    if (body.leads && Array.isArray(body.leads)) {
      return handleBulkRequest(body);
    }

    // Einzelne Anfrage
    const validation = singleRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { leadData, options, cellId } = validation.data;

    // Lade AI-Settings aus der Datenbank
    const aiSettings = await getUserAISettings();
    if (!aiSettings || !aiSettings.apiKey || !aiSettings.provider) {
      return NextResponse.json(
        {
          error: "KI nicht konfiguriert",
          message: "Bitte konfiguriere deinen API Key in den Einstellungen."
        },
        { status: 400 }
      );
    }

    const provider: AIProvider = aiSettings.provider as AIProvider;
    const apiKey = aiSettings.apiKey;

    // Optionen mit Preset mergen falls angegeben
    let mergedOptions: Partial<ComplimentOptions> = options || {};
    if (options?.preset && COMPLIMENT_PRESETS[options.preset]) {
      mergedOptions = {
        ...COMPLIMENT_PRESETS[options.preset],
        ...options,
      };
    }

    // Kompliment generieren
    const result = await generateCompliment(leadData, apiKey, mergedOptions, provider);

    // Optional: Direkt in Cell speichern
    if (cellId) {
      await prisma.cell.update({
        where: { id: cellId },
        data: {
          value: result.compliment,
          metadata: {
            source: "ai_generated",
            generatedAt: new Date().toISOString(),
            confidence: result.confidence,
            options: mergedOptions,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      compliment: result.compliment,
      confidence: result.confidence,
      savedToCell: !!cellId,
    });

  } catch (error) {
    console.error("Compliment generation error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der Kompliment-Generierung",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}

/**
 * Behandelt Bulk-Anfragen für mehrere Leads
 */
async function handleBulkRequest(body: unknown) {
  const validation = bulkRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid bulk request", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { leads, options } = validation.data;

  // Lade AI-Settings aus der Datenbank
  const aiSettings = await getUserAISettings();
  if (!aiSettings || !aiSettings.apiKey || !aiSettings.provider) {
    return NextResponse.json(
      {
        error: "KI nicht konfiguriert",
        message: "Bitte konfiguriere deinen API Key in den Einstellungen."
      },
      { status: 400 }
    );
  }

  const provider: AIProvider = aiSettings.provider as AIProvider;
  const apiKey = aiSettings.apiKey;

  // Optionen mit Preset mergen
  let mergedOptions: Partial<ComplimentOptions> = options || {};
  if (options?.preset && COMPLIMENT_PRESETS[options.preset]) {
    mergedOptions = {
      ...COMPLIMENT_PRESETS[options.preset],
      ...options,
    };
  }

  // Bulk-Generierung
  const results = await generateComplimentsBulk(
    leads.map((l) => ({ id: l.id, data: l.data })),
    apiKey,
    mergedOptions,
    provider
  );

  // Ergebnisse in Cells speichern wenn cellId vorhanden
  const cellUpdates: Promise<unknown>[] = [];
  const responseResults: Record<string, { compliment?: string; error?: string; confidence?: number }> = {};

  for (const lead of leads) {
    const result = results.get(lead.id);
    if (!result) continue;

    if ("error" in result) {
      responseResults[lead.id] = { error: result.error };
    } else {
      responseResults[lead.id] = {
        compliment: result.compliment,
        confidence: result.confidence,
      };

      // In Cell speichern wenn cellId vorhanden
      if (lead.cellId) {
        cellUpdates.push(
          prisma.cell.update({
            where: { id: lead.cellId },
            data: {
              value: result.compliment,
              metadata: {
                source: "ai_generated",
                generatedAt: new Date().toISOString(),
                confidence: result.confidence,
                options: mergedOptions,
              },
            },
          })
        );
      }
    }
  }

  // Alle Cell-Updates parallel ausführen
  if (cellUpdates.length > 0) {
    await Promise.all(cellUpdates);
  }

  const successCount = Object.values(responseResults).filter((r) => r.compliment).length;
  const errorCount = Object.values(responseResults).filter((r) => r.error).length;

  return NextResponse.json({
    success: true,
    results: responseResults,
    summary: {
      total: leads.length,
      success: successCount,
      errors: errorCount,
      savedToCells: cellUpdates.length,
    },
  });
}

/**
 * GET /api/ai/generate-compliment
 * Gibt verfügbare Presets und Optionen zurück
 */
export async function GET() {
  return NextResponse.json({
    presets: Object.keys(COMPLIMENT_PRESETS),
    options: {
      tones: ["professional", "friendly", "casual"],
      lengths: ["short", "medium", "long"],
      languages: ["de", "en"],
      focuses: ["website", "reviews", "business", "general"],
    },
    presetDetails: COMPLIMENT_PRESETS,
  });
}
