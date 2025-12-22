/**
 * AI Email Generation API
 *
 * POST /api/ai/email - Generate a new email
 * POST /api/ai/email/spintax - Generate spintax variations
 * POST /api/ai/email/spam-check - Check email for spam
 * POST /api/ai/email/improve - Improve existing email
 * POST /api/ai/email/subjects - Generate subject lines
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getUserAISettings } from "@/lib/user-settings";
import { AIProvider } from "@/lib/ai/providers";
import {
  generateEmail,
  EmailWriterInput,
} from "@/lib/ai/email-ai";

const generateEmailSchema = z.object({
  purpose: z.string().min(1, "Zweck ist erforderlich"),
  targetAudience: z.string().min(1, "Zielgruppe ist erforderlich"),
  tone: z.enum(["formal", "casual", "friendly", "professional"]).default("professional"),
  keyPoints: z.array(z.string()).optional(),
  callToAction: z.string().min(1, "Call-to-Action ist erforderlich"),
  language: z.enum(["de", "en"]).optional().default("de"),
  maxLength: z.enum(["short", "medium", "long"]).optional().default("medium"),
});

/**
 * POST /api/ai/email - Generate a new cold email
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = generateEmailSchema.safeParse(body);

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

    const input: EmailWriterInput = {
      purpose: validation.data.purpose,
      targetAudience: validation.data.targetAudience,
      tone: validation.data.tone,
      keyPoints: validation.data.keyPoints,
      callToAction: validation.data.callToAction,
      language: validation.data.language,
      maxLength: validation.data.maxLength,
    };

    const email = await generateEmail(
      input,
      aiSettings.apiKey,
      aiSettings.provider as AIProvider
    );

    return NextResponse.json({
      success: true,
      email,
      provider: aiSettings.provider,
    });
  } catch (error) {
    console.error("Email generation error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der E-Mail-Generierung",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
