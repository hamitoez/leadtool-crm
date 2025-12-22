import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().optional(),
  remindAt: z.string().datetime().optional(),
  status: z.enum(["PENDING", "SENT", "DISMISSED", "SNOOZED", "COMPLETED"]).optional(),
});

// GET /api/reminders/[reminderId]
export async function GET(
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
      include: {
        activity: true,
        row: {
          include: {
            cells: { include: { column: true } },
            table: { select: { id: true, name: true, projectId: true } },
          },
        },
      },
    });

    if (!reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    return NextResponse.json(reminder);
  } catch (error) {
    console.error("Error fetching reminder:", error);
    return NextResponse.json({ error: "Failed to fetch reminder" }, { status: 500 });
  }
}

// PATCH /api/reminders/[reminderId]
export async function PATCH(
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
    const data = updateReminderSchema.parse(body);

    const updated = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        ...data,
        remindAt: data.remindAt ? new Date(data.remindAt) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating reminder:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

// DELETE /api/reminders/[reminderId]
export async function DELETE(
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

    await prisma.reminder.delete({
      where: { id: reminderId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
