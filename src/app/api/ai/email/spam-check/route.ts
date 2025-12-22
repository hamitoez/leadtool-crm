/**
 * AI Spam Check API
 *
 * POST /api/ai/email/spam-check - Analyze email for spam triggers
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getUserAISettings } from "@/lib/user-settings";
import { AIProvider } from "@/lib/ai/providers";
import { checkSpam } from "@/lib/ai/email-ai";

const spamCheckSchema = z.object({
  subject: z.string().min(1, "Betreff ist erforderlich"),
  body: z.string().min(1, "E-Mail-Text ist erforderlich"),
});

/**
 * POST /api/ai/email/spam-check - Check email for spam triggers
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = spamCheckSchema.safeParse(body);

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

    const result = await checkSpam(
      validation.data.subject,
      validation.data.body,
      aiSettings.apiKey,
      aiSettings.provider as AIProvider
    );

    return NextResponse.json({
      success: true,
      ...result,
      provider: aiSettings.provider,
    });
  } catch (error) {
    console.error("Spam check error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der Spam-Analyse",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
