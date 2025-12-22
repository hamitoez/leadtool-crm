import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateActivitySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["PLANNED", "COMPLETED", "CANCELLED", "MISSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  callDuration: z.number().int().min(0).optional(),
  callOutcome: z.string().optional(),
  meetingLocation: z.string().optional(),
  meetingLink: z.string().url().optional(),
  meetingDuration: z.number().int().min(0).optional(),
});

// Helper to verify activity access
async function verifyActivityAccess(activityId: string, userId: string) {
  return prisma.activity.findFirst({
    where: {
      id: activityId,
      row: { table: { project: { userId } } },
    },
  });
}

// GET /api/activities/[activityId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    const activity = await verifyActivityAccess(activityId, session.user.id);

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const fullActivity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        row: {
          include: {
            cells: { include: { column: true } },
            table: { select: { id: true, name: true } },
          },
        },
        reminders: {
          orderBy: { remindAt: "asc" },
        },
      },
    });

    return NextResponse.json(fullActivity);
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}

// PATCH /api/activities/[activityId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    const activity = await verifyActivityAccess(activityId, session.user.id);

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateActivitySchema.parse(body);

    const updated = await prisma.activity.update({
      where: { id: activityId },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
        completedAt: data.status === "COMPLETED" ? new Date() : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating activity:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
  }
}

// DELETE /api/activities/[activityId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    const activity = await verifyActivityAccess(activityId, session.user.id);

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    await prisma.activity.delete({
      where: { id: activityId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return NextResponse.json({ error: "Failed to delete activity" }, { status: 500 });
  }
}
