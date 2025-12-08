import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { generateText, AIProvider } from "@/lib/ai/providers";

const requestSchema = z.object({
  prompt: z.string().min(1),
  apiKey: z.string().min(1),
  provider: z.enum(["anthropic", "openai", "google", "mistral", "groq", "deepseek"]).optional(),
  maxTokens: z.number().optional(),
});

/**
 * POST /api/ai/generate
 * General-purpose AI text generation
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { prompt, apiKey, provider = "anthropic", maxTokens = 1000 } = validation.data;

    const text = await generateText(prompt, apiKey, provider as AIProvider, maxTokens);

    return NextResponse.json({
      success: true,
      text,
      provider,
    });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      {
        error: "Fehler bei der KI-Generierung",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
