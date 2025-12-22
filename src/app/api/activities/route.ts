import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { dispatchActivityCreated } from "@/lib/webhook-dispatcher";

const createActivitySchema = z.object({
  rowId: z.string(),
  type: z.enum([
    "CALL",
    "EMAIL",
    "MEETING",
    "NOTE",
    "TASK",
    "DOCUMENT",
    "COMMENT",
  ]),
  status: z.enum(["PLANNED", "COMPLETED", "CANCELLED", "MISSED"]).optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),

  // Task fields
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional(),

  // Call fields
  callDuration: z.number().int().min(0).optional(),
  callOutcome: z.string().optional(),

  // Meeting fields
  meetingLocation: z.string().optional(),
  meetingLink: z.string().url().optional(),
  meetingDuration: z.number().int().min(0).optional(),
  attendees: z.array(z.string().email()).optional(),

  // Email fields
  emailSubject: z.string().optional(),
  emailTo: z.string().optional(),
  emailCc: z.string().optional(),

  // Document fields
  documentUrl: z.string().url().optional(),
  documentName: z.string().optional(),
  documentType: z.string().optional(),
});

// GET /api/activities - Get all activities (with filters)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rowId = searchParams.get("rowId");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const organizationId = searchParams.get("organizationId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get user's organization memberships
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    // Build project filter
    const projectFilter = organizationId
      ? { organizationId }
      : {
          OR: [
            { userId: session.user.id },
            { organizationId: { in: userOrgIds } },
          ],
        };

    const where: Record<string, unknown> = {
      row: { table: { project: projectFilter } },
    };

    if (rowId) where.rowId = rowId;
    if (type) where.type = type;
    if (status) where.status = status;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
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
          _count: { select: { reminders: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activity.count({ where }),
    ]);

    return NextResponse.json({
      activities,
      total,
      hasMore: offset + activities.length < total,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createActivitySchema.parse(body);

    // Get user's organization memberships
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    // Verify row access (own project OR org member)
    const row = await prisma.row.findFirst({
      where: {
        id: data.rowId,
        table: {
          project: {
            OR: [
              { userId: session.user.id },
              { organizationId: { in: userOrgIds } },
            ],
          },
        },
      },
      include: {
        table: {
          select: {
            project: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    const orgId = row.table.project.organizationId;

    const activity = await prisma.activity.create({
      data: {
        rowId: data.rowId,
        userId: session.user.id,
        type: data.type,
        status: data.status || (data.type === "TASK" ? "PLANNED" : "COMPLETED"),
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        callDuration: data.callDuration,
        callOutcome: data.callOutcome,
        meetingLocation: data.meetingLocation,
        meetingLink: data.meetingLink,
        meetingDuration: data.meetingDuration,
        attendees: data.attendees,
        emailSubject: data.emailSubject,
        emailTo: data.emailTo,
        emailCc: data.emailCc,
        documentUrl: data.documentUrl,
        documentName: data.documentName,
        documentType: data.documentType,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Create history entry
    const historyEventMap: Record<string, string> = {
      CALL: "CALL_LOGGED",
      EMAIL: "EMAIL_SENT",
      MEETING: data.status === "PLANNED" ? "MEETING_SCHEDULED" : "MEETING_COMPLETED",
      NOTE: "NOTE_ADDED",
      TASK: "TASK_CREATED",
      DOCUMENT: "DOCUMENT_UPLOADED",
      COMMENT: "NOTE_ADDED",
    };

    await prisma.contactHistory.create({
      data: {
        rowId: data.rowId,
        userId: session.user.id,
        eventType: historyEventMap[data.type] as "CALL_LOGGED" | "EMAIL_SENT" | "MEETING_SCHEDULED" | "MEETING_COMPLETED" | "NOTE_ADDED" | "TASK_CREATED" | "DOCUMENT_UPLOADED",
        title: data.title,
        description: data.description,
        activityId: activity.id,
        metadata: {
          type: data.type,
          status: activity.status,
        },
      },
    });

    // Dispatch webhook (fire and forget)
    if (orgId) {
      dispatchActivityCreated(orgId, {
        id: activity.id,
        rowId: activity.rowId,
        type: activity.type,
        title: activity.title,
        userId: activity.userId,
      });
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Error creating activity:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }
}
