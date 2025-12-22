/**
 * AI Reply Suggestions API
 *
 * POST /api/ai/email/reply-suggestions - Generate reply suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getUserAISettings } from "@/lib/user-settings";
import { AIProvider } from "@/lib/ai/providers";
import { generateReplySuggestions } from "@/lib/ai/email-ai";

const replySuggestionsSchema = z.object({
  originalEmail: z.string().min(1, "Original-E-Mail ist erforderlich"),
  replyEmail: z.string().min(1, "Antwort-E-Mail ist erforderlich"),
  replyIntent: z.string().nullable().optional(),
  context: z.object({
    recipientName: z.string().optional(),
    company: z.string().optional(),
    campaignName: z.string().optional(),
  }).optional(),
});

/**
 * POST /api/ai/email/reply-suggestions - Generate smart reply suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = replySuggestionsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Ungültige Eingabe", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const aiSettings = await getUserAISettings();
    if (!aiSettings?.apiKey || !aiSettings?.provider) {
      return NextResponse.json(
        {
          error: "KI nicht konfiguriert",
          message: "Bitte konfiguriere deinen API Key in den Einstellungen.",
        },
        { status: 400 }
      );
    }

    const suggestions = await generateReplySuggestions(
      validation.data.originalEmail,
      validation.data.replyEmail,
      validation.data.replyIntent || null,
      validation.data.context || {},
      aiSettings.apiKey,
      aiSettings.provider as AIProvider
    );

    return NextResponse.json({
      success: true,
      suggestions,
      provider: aiSettings.provider,
    });
  } catch (error) {
    console.error("Reply suggestions error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der Generierung von Antwortvorschlägen",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
