import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const snoozeSchema = z.object({
  duration: z.enum(["15m", "1h", "3h", "tomorrow", "next_week"]),
});

// POST /api/reminders/[reminderId]/snooze
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

    const body = await request.json();
    const { duration } = snoozeSchema.parse(body);

    // Calculate snooze until time
    const now = new Date();
    let snoozedUntil: Date;

    switch (duration) {
      case "15m":
        snoozedUntil = new Date(now.getTime() + 15 * 60 * 1000);
        break;
      case "1h":
        snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case "3h":
        snoozedUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        break;
      case "tomorrow":
        snoozedUntil = new Date(now);
        snoozedUntil.setDate(snoozedUntil.getDate() + 1);
        snoozedUntil.setHours(9, 0, 0, 0); // 9 AM tomorrow
        break;
      case "next_week":
        snoozedUntil = new Date(now);
        snoozedUntil.setDate(snoozedUntil.getDate() + 7);
        snoozedUntil.setHours(9, 0, 0, 0); // 9 AM next week
        break;
      default:
        snoozedUntil = new Date(now.getTime() + 15 * 60 * 1000);
    }

    const updated = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: "SNOOZED",
        snoozedUntil,
        snoozeCount: { increment: 1 },
        remindAt: snoozedUntil, // Update remindAt for next trigger
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error snoozing reminder:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to snooze reminder" }, { status: 500 });
  }
}
