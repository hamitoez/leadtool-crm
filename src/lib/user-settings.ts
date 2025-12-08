import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface UserAISettings {
  provider: string | null;
  apiKey: string | null;
  model: string | null;
}

/**
 * Get AI settings for the current user from database
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

  return {
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
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
