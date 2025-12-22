import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/activities/overdue - Get overdue tasks
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

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

    const overdueTasks = await prisma.activity.findMany({
      where: {
        row: { table: { project: projectFilter } },
        type: "TASK",
        status: "PLANNED",
        dueDate: {
          lt: now,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        row: {
          select: {
            id: true,
            cells: {
              include: { column: true },
              where: { column: { type: { in: ["TEXT", "COMPANY", "PERSON"] } } },
              take: 2,
            },
            table: { select: { id: true, name: true, projectId: true } },
            deal: {
              select: {
                id: true,
                value: true,
                stage: { select: { name: true, color: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { priority: "desc" }, // URGENT first
        { dueDate: "asc" },   // Then oldest first
      ],
    });

    // Calculate days overdue for each task
    const tasksWithDaysOverdue = overdueTasks.map((task) => ({
      ...task,
      daysOverdue: task.dueDate
        ? Math.ceil((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
    }));

    // Group by priority
    const byPriority = {
      URGENT: tasksWithDaysOverdue.filter((t) => t.priority === "URGENT"),
      HIGH: tasksWithDaysOverdue.filter((t) => t.priority === "HIGH"),
      MEDIUM: tasksWithDaysOverdue.filter((t) => t.priority === "MEDIUM"),
      LOW: tasksWithDaysOverdue.filter((t) => t.priority === "LOW"),
      NONE: tasksWithDaysOverdue.filter((t) => !t.priority),
    };

    return NextResponse.json({
      tasks: tasksWithDaysOverdue,
      byPriority,
      total: overdueTasks.length,
    });
  } catch (error) {
    console.error("Error fetching overdue tasks:", error);
    return NextResponse.json({ error: "Failed to fetch overdue tasks" }, { status: 500 });
  }
}
