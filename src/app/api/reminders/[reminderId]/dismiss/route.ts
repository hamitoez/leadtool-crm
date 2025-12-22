import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/reminders/[reminderId]/dismiss
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reminderId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reminderId } = await params;

    const reminder = await prisma.reminder.findFirst({
      where: {
        id: reminderId,
        userId: session.user.id,
      },
    });

    if (!reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    const updated = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: "DISMISSED",
        dismissedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error dismissing reminder:", error);
    return NextResponse.json({ error: "Failed to dismiss reminder" }, { status: 500 });
  }
}
