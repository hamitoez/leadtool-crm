import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/activities/[activityId]/complete - Mark activity as completed
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;

    // Verify access
    const activity = await prisma.activity.findFirst({
      where: {
        id: activityId,
        row: { table: { project: { userId: session.user.id } } },
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const updated = await prisma.activity.update({
      where: { id: activityId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Create history entry for task completion
    if (activity.type === "TASK") {
      await prisma.contactHistory.create({
        data: {
          rowId: activity.rowId,
          userId: session.user.id,
          eventType: "TASK_COMPLETED",
          title: `Task erledigt: ${activity.title}`,
          activityId: activity.id,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error completing activity:", error);
    return NextResponse.json({ error: "Failed to complete activity" }, { status: 500 });
  }
}
