/**
 * AI Email Improve API
 *
 * POST /api/ai/email/improve - Improve an existing email
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getUserAISettings } from "@/lib/user-settings";
import { AIProvider } from "@/lib/ai/providers";
import { improveEmail } from "@/lib/ai/email-ai";

const improveEmailSchema = z.object({
  subject: z.string().min(1, "Betreff ist erforderlich"),
  body: z.string().min(1, "E-Mail-Text ist erforderlich"),
  improvements: z.array(
    z.enum(["clarity", "persuasion", "personalization", "brevity", "cta"])
  ).min(1, "Mindestens eine Verbesserung auswählen"),
});

/**
 * POST /api/ai/email/improve - Improve existing email
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = improveEmailSchema.safeParse(body);

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

    const improvedEmail = await improveEmail(
      validation.data.subject,
      validation.data.body,
      validation.data.improvements,
      aiSettings.apiKey,
      aiSettings.provider as AIProvider
    );

    return NextResponse.json({
      success: true,
      email: improvedEmail,
      improvements: validation.data.improvements,
      provider: aiSettings.provider,
    });
  } catch (error) {
    console.error("Email improve error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der E-Mail-Verbesserung",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
