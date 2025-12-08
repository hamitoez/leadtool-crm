import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";

const validateSchema = z.object({
  provider: z.enum(["anthropic", "openai", "google", "deepseek", "mistral", "groq"]),
  apiKey: z.string().min(1),
});

/**
 * POST /api/settings/validate-api-key
 * Validates an API key by making a test request to the provider
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { valid: false, error: "Invalid request" },
        { status: 400 }
      );
    }

    const { provider, apiKey } = validation.data;

    // Validate the API key by making a test request
    const result = await validateApiKey(provider, apiKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error("API key validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}

async function validateApiKey(
  provider: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string; model?: string }> {
  const testPrompt = "Say 'OK' in one word.";

  try {
    switch (provider) {
      case "deepseek":
        return await validateDeepSeek(apiKey, testPrompt);
      case "google":
        return await validateGoogle(apiKey, testPrompt);
      case "anthropic":
        return await validateAnthropic(apiKey, testPrompt);
      case "openai":
        return await validateOpenAI(apiKey, testPrompt);
      case "mistral":
        return await validateMistral(apiKey, testPrompt);
      case "groq":
        return await validateGroq(apiKey, testPrompt);
      default:
        return { valid: false, error: "Unknown provider" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { valid: false, error: message };
  }
}

async function validateDeepSeek(apiKey: string, prompt: string) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
    }),
  });

  if (response.status === 401) {
    return { valid: false, error: "Ungültiger API Key" };
  }
  if (response.status === 429) {
    return { valid: false, error: "Rate Limit überschritten - Key ist aber gültig" };
  }
  if (!response.ok) {
    const text = await response.text();
    // Check for insufficient balance
    if (text.includes("Insufficient Balance")) {
      return { valid: false, error: "Kein Guthaben mehr! Bitte lade dein DeepSeek-Konto auf: platform.deepseek.com" };
    }
    return { valid: false, error: `API Fehler: ${text.slice(0, 100)}` };
  }

  return { valid: true, model: "deepseek-chat" };
}

async function validateGoogle(apiKey: string, prompt: string) {
  // Try multiple models
  const models = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-pro"];

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (response.status === 400 && (await response.text()).includes("API_KEY_INVALID")) {
      return { valid: false, error: "Ungültiger API Key" };
    }
    if (response.status === 429) {
      return { valid: false, error: "Quota überschritten - bitte warte oder erstelle einen neuen Key" };
    }
    if (response.ok) {
      return { valid: true, model };
    }
  }

  return { valid: false, error: "Kein funktionierendes Gemini-Modell gefunden" };
}

async function validateAnthropic(apiKey: string, prompt: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (response.status === 401) {
    return { valid: false, error: "Ungültiger API Key" };
  }
  if (response.status === 429) {
    return { valid: false, error: "Rate Limit überschritten" };
  }
  if (!response.ok) {
    const text = await response.text();
    return { valid: false, error: `API Fehler: ${text.slice(0, 100)}` };
  }

  return { valid: true, model: "claude-3-5-sonnet" };
}

async function validateOpenAI(apiKey: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
    }),
  });

  if (response.status === 401) {
    return { valid: false, error: "Ungültiger API Key" };
  }
  if (response.status === 429) {
    return { valid: false, error: "Rate Limit oder Quota überschritten" };
  }
  if (!response.ok) {
    const text = await response.text();
    return { valid: false, error: `API Fehler: ${text.slice(0, 100)}` };
  }

  return { valid: true, model: "gpt-4o-mini" };
}

async function validateMistral(apiKey: string, prompt: string) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
    }),
  });

  if (response.status === 401) {
    return { valid: false, error: "Ungültiger API Key" };
  }
  if (!response.ok) {
    return { valid: false, error: "API Fehler" };
  }

  return { valid: true, model: "mistral-small" };
}

async function validateGroq(apiKey: string, prompt: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
    }),
  });

  if (response.status === 401) {
    return { valid: false, error: "Ungültiger API Key" };
  }
  if (!response.ok) {
    return { valid: false, error: "API Fehler" };
  }

  return { valid: true, model: "llama-3.1-8b" };
}
