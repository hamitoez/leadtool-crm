import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { encrypt, decrypt, maskApiKey } from "@/lib/security/encryption";

// Validation schema for profile updates
const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Validation schema for password updates - stronger requirements
const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// Validation schema for AI settings
const aiSettingsSchema = z.object({
  aiProvider: z.enum(["anthropic", "openai", "google", "mistral", "groq", "deepseek"]).optional().nullable(),
  aiApiKey: z.string().min(10).max(200).optional().nullable(),
  aiModel: z.string().max(100).optional().nullable(),
});

// GET - Get user settings
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        settings: {
          select: {
            aiProvider: true,
            aiModel: true,
            aiApiKey: true,
            language: true,
            theme: true,
            enableAiFeatures: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mask API key for security display
    let maskedApiKey: string | null = null;
    let hasApiKey = false;

    if (user.settings?.aiApiKey) {
      // Decrypt the API key first, then mask it
      const decryptedKey = decrypt(user.settings.aiApiKey);
      if (decryptedKey) {
        hasApiKey = true;
        maskedApiKey = maskApiKey(decryptedKey);
      }
    }

    const maskedSettings = user.settings ? {
      aiProvider: user.settings.aiProvider,
      aiModel: user.settings.aiModel,
      aiApiKey: maskedApiKey,
      hasApiKey,
      language: user.settings.language,
      theme: user.settings.theme,
      enableAiFeatures: user.settings.enableAiFeatures,
    } : null;

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: user.createdAt,
        settings: maskedSettings,
      }
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;

    if (type === "profile") {
      const validation = profileUpdateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: validation.error.issues },
          { status: 400 }
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(validation.data.name && { name: validation.data.name }),
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      return NextResponse.json({
        user: updatedUser,
        message: "Profile updated successfully",
      });
    }

    if (type === "password") {
      const validation = passwordUpdateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: validation.error.issues },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      });

      if (!user?.password) {
        return NextResponse.json(
          { error: "Cannot change password for OAuth accounts" },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(
        validation.data.currentPassword,
        user.password
      );

      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(validation.data.newPassword, 12);

      await prisma.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({
        message: "Password updated successfully",
      });
    }

    if (type === "ai-settings") {
      const validation = aiSettingsSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: validation.error.issues },
          { status: 400 }
        );
      }

      // Encrypt API key before storing
      const encryptedApiKey = validation.data.aiApiKey
        ? encrypt(validation.data.aiApiKey)
        : null;

      // Upsert user settings
      const settings = await prisma.userSettings.upsert({
        where: { userId: session.user.id },
        update: {
          aiProvider: validation.data.aiProvider,
          aiApiKey: encryptedApiKey,
          aiModel: validation.data.aiModel,
        },
        create: {
          userId: session.user.id,
          aiProvider: validation.data.aiProvider,
          aiApiKey: encryptedApiKey,
          aiModel: validation.data.aiModel,
        },
      });

      return NextResponse.json({
        message: "AI settings updated successfully",
        settings: {
          aiProvider: settings.aiProvider,
          aiModel: settings.aiModel,
          hasApiKey: !!settings.aiApiKey,
        },
      });
    }

    if (type === "remove-ai") {
      // Remove AI settings
      await prisma.userSettings.upsert({
        where: { userId: session.user.id },
        update: {
          aiProvider: null,
          aiApiKey: null,
          aiModel: null,
        },
        create: {
          userId: session.user.id,
        },
      });

      return NextResponse.json({
        message: "AI settings removed successfully",
      });
    }

    return NextResponse.json(
      { error: "Invalid update type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
