import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";

// Validation schema for profile updates
const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Validation schema for password updates
const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// Validation schema for AI settings
const aiSettingsSchema = z.object({
  aiProvider: z.string().optional().nullable(),
  aiApiKey: z.string().optional().nullable(),
  aiModel: z.string().optional().nullable(),
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

    // Mask API key for security (only show last 4 chars)
    const maskedSettings = user.settings ? {
      ...user.settings,
      aiApiKey: user.settings.aiApiKey
        ? `${"•".repeat(20)}${user.settings.aiApiKey.slice(-4)}`
        : null,
      hasApiKey: !!user.settings.aiApiKey,
    } : null;

    return NextResponse.json({
      user: {
        ...user,
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

      // Upsert user settings
      const settings = await prisma.userSettings.upsert({
        where: { userId: session.user.id },
        update: {
          aiProvider: validation.data.aiProvider,
          aiApiKey: validation.data.aiApiKey,
          aiModel: validation.data.aiModel,
        },
        create: {
          userId: session.user.id,
          aiProvider: validation.data.aiProvider,
          aiApiKey: validation.data.aiApiKey,
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
