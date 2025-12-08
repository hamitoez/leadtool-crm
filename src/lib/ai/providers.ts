import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type AIProvider = "anthropic" | "openai" | "google" | "mistral" | "groq" | "deepseek";

// Provider-specific models
export const PROVIDER_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-1.5-flash",
  mistral: "mistral-large-latest",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
};

export async function generateWithAnthropic(
  prompt: string,
  apiKey: string,
  maxTokens: number = 500
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: PROVIDER_MODELS.anthropic,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("Keine Textantwort von Claude erhalten");
  }
  return textContent.text.trim();
}

export async function generateWithOpenAI(
  prompt: string,
  apiKey: string,
  maxTokens: number = 500
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: PROVIDER_MODELS.openai,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Keine Textantwort von OpenAI erhalten");
  }
  return content.trim();
}

export async function generateWithGoogle(
  prompt: string,
  apiKey: string,
  maxTokens: number = 500
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDER_MODELS.google}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API Fehler: ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Keine Textantwort von Google erhalten");
  }
  return content.trim();
}

export async function generateWithMistral(
  prompt: string,
  apiKey: string,
  maxTokens: number = 500
): Promise<string> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PROVIDER_MODELS.mistral,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API Fehler: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Keine Textantwort von Mistral erhalten");
  }
  return content.trim();
}

export async function generateWithGroq(
  prompt: string,
  apiKey: string,
  maxTokens: number = 500
): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PROVIDER_MODELS.groq,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API Fehler: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Keine Textantwort von Groq erhalten");
  }
  return content.trim();
}

export async function generateWithDeepSeek(
  prompt: string,
  apiKey: string,
  maxTokens: number = 500
): Promise<string> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PROVIDER_MODELS.deepseek,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API Fehler: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Keine Textantwort von DeepSeek erhalten");
  }
  return content.trim();
}

/**
 * Generate text with any supported AI provider
 */
export async function generateText(
  prompt: string,
  apiKey: string,
  provider: AIProvider = "anthropic",
  maxTokens: number = 500
): Promise<string> {
  switch (provider) {
    case "anthropic":
      return generateWithAnthropic(prompt, apiKey, maxTokens);
    case "openai":
      return generateWithOpenAI(prompt, apiKey, maxTokens);
    case "google":
      return generateWithGoogle(prompt, apiKey, maxTokens);
    case "mistral":
      return generateWithMistral(prompt, apiKey, maxTokens);
    case "groq":
      return generateWithGroq(prompt, apiKey, maxTokens);
    case "deepseek":
      return generateWithDeepSeek(prompt, apiKey, maxTokens);
    default:
      throw new Error(`Unbekannter KI-Anbieter: ${provider}`);
  }
}
