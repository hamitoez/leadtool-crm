/**
 * AI Subject Line Generator API
 *
 * POST /api/ai/email/subjects - Generate subject line variations
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getUserAISettings } from "@/lib/user-settings";
import { AIProvider } from "@/lib/ai/providers";
import { generateSubjectLines } from "@/lib/ai/email-ai";

const subjectsSchema = z.object({
  body: z.string().min(1, "E-Mail-Text ist erforderlich"),
  count: z.number().int().min(1).max(10).optional().default(5),
});

/**
 * POST /api/ai/email/subjects - Generate subject line variations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = subjectsSchema.safeParse(body);

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

    const subjects = await generateSubjectLines(
      validation.data.body,
      validation.data.count,
      aiSettings.apiKey,
      aiSettings.provider as AIProvider
    );

    return NextResponse.json({
      success: true,
      subjects,
      provider: aiSettings.provider,
    });
  } catch (error) {
    console.error("Subject generation error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der Betreffzeilen-Generierung",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
