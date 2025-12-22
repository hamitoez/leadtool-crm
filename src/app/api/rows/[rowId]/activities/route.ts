import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/rows/[rowId]/activities - Get activities for a specific row
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rowId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    // Get user's organization memberships
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    const projectFilter = {
      OR: [
        { userId: session.user.id },
        { organizationId: { in: userOrgIds } },
      ],
    };

    // Verify row access
    const row = await prisma.row.findFirst({
      where: {
        id: rowId,
        table: { project: projectFilter },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    const where: Record<string, unknown> = { rowId };
    if (type) where.type = type;
    if (status) where.status = status;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        reminders: {
          where: { status: "PENDING" },
          orderBy: { remindAt: "asc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get summary
    const summary = {
      total: activities.length,
      byType: {
        CALL: activities.filter((a) => a.type === "CALL").length,
        EMAIL: activities.filter((a) => a.type === "EMAIL").length,
        MEETING: activities.filter((a) => a.type === "MEETING").length,
        NOTE: activities.filter((a) => a.type === "NOTE").length,
        TASK: activities.filter((a) => a.type === "TASK").length,
      },
      pendingTasks: activities.filter(
        (a) => a.type === "TASK" && a.status === "PLANNED"
      ).length,
      lastActivity: activities[0]?.createdAt || null,
    };

    return NextResponse.json({ activities, summary });
  } catch (error) {
    console.error("Error fetching row activities:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}
