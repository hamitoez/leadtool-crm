import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createReminderSchema = z.object({
  activityId: z.string().optional(),
  rowId: z.string().optional(),
  type: z.enum(["BEFORE_ACTIVITY", "FOLLOW_UP", "CUSTOM", "RECURRING", "DEADLINE"]),
  remindAt: z.string().datetime(),
  title: z.string().min(1).max(200),
  message: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringRule: z.string().optional(),
});

// GET /api/reminders - Get all reminders for user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const rowId = searchParams.get("rowId");

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (status) where.status = status;
    if (rowId) where.rowId = rowId;

    const reminders = await prisma.reminder.findMany({
      where,
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

    return NextResponse.json(reminders);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

// POST /api/reminders - Create a new reminder
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createReminderSchema.parse(body);

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

    // Verify row access if rowId provided
    if (data.rowId) {
      const row = await prisma.row.findFirst({
        where: {
          id: data.rowId,
          table: { project: projectFilter },
        },
      });

      if (!row) {
        return NextResponse.json({ error: "Row not found" }, { status: 404 });
      }
    }

    // Verify activity access if activityId provided
    if (data.activityId) {
      const activity = await prisma.activity.findFirst({
        where: {
          id: data.activityId,
          row: { table: { project: { userId: session.user.id } } },
        },
      });

      if (!activity) {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      }

      // If no rowId provided, use activity's rowId
      if (!data.rowId) {
        data.rowId = activity.rowId;
      }
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId: session.user.id,
        activityId: data.activityId,
        rowId: data.rowId,
        type: data.type,
        remindAt: new Date(data.remindAt),
        title: data.title,
        message: data.message,
        isRecurring: data.isRecurring ?? false,
        recurringRule: data.recurringRule,
        nextOccurrence: data.isRecurring ? new Date(data.remindAt) : undefined,
      },
      include: {
        activity: { select: { id: true, title: true, type: true } },
        row: {
          select: {
            id: true,
            cells: {
              include: { column: true },
              where: { column: { type: { in: ["TEXT", "COMPANY"] } } },
              take: 1,
            },
          },
        },
      },
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    console.error("Error creating reminder:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
