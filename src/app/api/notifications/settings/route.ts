import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

// GET - Get notification settings
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: {
        notifyScrapingComplete: true,
        notifyScrapingFailed: true,
        notifyImportComplete: true,
        notifyImportFailed: true,
        emailNotifications: true,
      },
    });

    // Return defaults if no settings exist
    return NextResponse.json({
      settings: settings || {
        notifyScrapingComplete: true,
        notifyScrapingFailed: true,
        notifyImportComplete: true,
        notifyImportFailed: true,
        emailNotifications: false,
      },
    });
  } catch (error) {
    console.error("Error fetching notification settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Validation schema for notification settings
const notificationSettingsSchema = z.object({
  notifyScrapingComplete: z.boolean().optional(),
  notifyScrapingFailed: z.boolean().optional(),
  notifyImportComplete: z.boolean().optional(),
  notifyImportFailed: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

// PUT - Update notification settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = notificationSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: validation.data,
      create: {
        userId: session.user.id,
        ...validation.data,
      },
      select: {
        notifyScrapingComplete: true,
        notifyScrapingFailed: true,
        notifyImportComplete: true,
        notifyImportFailed: true,
        emailNotifications: true,
      },
    });

    return NextResponse.json({
      message: "Notification settings updated",
      settings,
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
