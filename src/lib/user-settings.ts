import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/security/encryption";

export interface UserAISettings {
  provider: string | null;
  apiKey: string | null;
  model: string | null;
}

/**
 * Get AI settings for the current user from database
 * API key is decrypted before returning
 */
export async function getUserAISettings(): Promise<UserAISettings | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: {
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
    },
  });

  if (!settings || !settings.aiProvider || !settings.aiApiKey) {
    return null;
  }

  // Decrypt the API key
  const decryptedApiKey = decrypt(settings.aiApiKey);

  if (!decryptedApiKey) {
    console.error("Failed to decrypt API key for user:", session.user.id);
    return null;
  }

  return {
    provider: settings.aiProvider,
    apiKey: decryptedApiKey,
    model: settings.aiModel,
  };
}

/**
 * Get AI settings for a specific user by ID
 * Used by backend services that need user's API key
 */
export async function getUserAISettingsById(userId: string): Promise<UserAISettings | null> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
    },
  });

  if (!settings || !settings.aiProvider || !settings.aiApiKey) {
    return null;
  }

  // Decrypt the API key
  const decryptedApiKey = decrypt(settings.aiApiKey);

  if (!decryptedApiKey) {
    console.error("Failed to decrypt API key for user:", userId);
    return null;
  }

  return {
    provider: settings.aiProvider,
    apiKey: decryptedApiKey,
    model: settings.aiModel,
  };
}

/**
 * Check if user has AI configured
 */
export async function hasAIConfigured(): Promise<boolean> {
  const settings = await getUserAISettings();
  return settings !== null && settings.provider !== null && settings.apiKey !== null;
}
