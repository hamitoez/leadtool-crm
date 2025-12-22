/**
 * AI Spintax Generator API
 *
 * POST /api/ai/email/spintax - Generate spintax variations for an email
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getUserAISettings } from "@/lib/user-settings";
import { AIProvider } from "@/lib/ai/providers";
import { generateSpintax } from "@/lib/ai/email-ai";

const spintaxSchema = z.object({
  body: z.string().min(1, "E-Mail-Text ist erforderlich"),
  variationLevel: z.enum(["light", "moderate", "heavy"]).optional().default("moderate"),
});

/**
 * POST /api/ai/email/spintax - Generate spintax variations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = spintaxSchema.safeParse(body);

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

    const spintaxBody = await generateSpintax(
      validation.data.body,
      aiSettings.apiKey,
      aiSettings.provider as AIProvider,
      validation.data.variationLevel
    );

    return NextResponse.json({
      success: true,
      body: spintaxBody,
      variationLevel: validation.data.variationLevel,
      provider: aiSettings.provider,
    });
  } catch (error) {
    console.error("Spintax generation error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der Spintax-Generierung",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
