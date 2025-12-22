import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/reminders/upcoming - Get upcoming reminders (next 24h)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get pending reminders in next 24 hours
    const upcoming = await prisma.reminder.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "SNOOZED"] },
        remindAt: {
          gte: now,
          lte: in24Hours,
        },
      },
      include: {
        activity: {
          select: { id: true, title: true, type: true, dueDate: true },
        },
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
      orderBy: { remindAt: "asc" },
    });

    // Get due reminders (past due but not yet handled)
    const due = await prisma.reminder.findMany({
      where: {
        userId: session.user.id,
        status: "PENDING",
        remindAt: {
          lt: now,
        },
      },
      include: {
        activity: {
          select: { id: true, title: true, type: true, dueDate: true },
        },
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
      orderBy: { remindAt: "asc" },
    });

    return NextResponse.json({
      upcoming,
      due,
      total: upcoming.length + due.length,
      dueCount: due.length,
    });
  } catch (error) {
    console.error("Error fetching upcoming reminders:", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}
