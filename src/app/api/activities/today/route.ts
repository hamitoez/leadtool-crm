import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/activities/today - Get today's activities and tasks
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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

    // Get activities created today and tasks due today
    const [activitiesToday, tasksDueToday] = await Promise.all([
      // Activities logged today
      prisma.activity.findMany({
        where: {
          row: { table: { project: projectFilter } },
          createdAt: {
            gte: today,
            lt: tomorrow,
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
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Tasks due today
      prisma.activity.findMany({
        where: {
          row: { table: { project: projectFilter } },
          type: "TASK",
          status: "PLANNED",
          dueDate: {
            gte: today,
            lt: tomorrow,
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
            },
          },
        },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    // Get planned activities for today (meetings, calls)
    const plannedToday = await prisma.activity.findMany({
      where: {
        row: { table: { project: projectFilter } },
        type: { in: ["MEETING", "CALL"] },
        status: "PLANNED",
        dueDate: {
          gte: today,
          lt: tomorrow,
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
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({
      activitiesToday,
      tasksDueToday,
      plannedToday,
      summary: {
        activitiesCount: activitiesToday.length,
        tasksDueCount: tasksDueToday.length,
        plannedCount: plannedToday.length,
      },
    });
  } catch (error) {
    console.error("Error fetching today's activities:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}
