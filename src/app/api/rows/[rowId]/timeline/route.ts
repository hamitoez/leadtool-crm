import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface TimelineEntry {
  id: string;
  type: "activity" | "history";
  eventType: string;
  title: string;
  description?: string | null;
  createdAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  metadata?: Record<string, unknown>;
  // Activity-specific
  activityType?: string;
  activityStatus?: string;
  // History-specific
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

// GET /api/rows/[rowId]/timeline - Get combined timeline
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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter"); // "all", "activities", "changes"

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
      include: {
        deal: {
          include: {
            stage: { select: { name: true, color: true, stageType: true } },
          },
        },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    const timeline: TimelineEntry[] = [];

    // Get activities (unless filter is "changes")
    if (filter !== "changes") {
      const activities = await prisma.activity.findMany({
        where: { rowId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      activities.forEach((activity) => {
        timeline.push({
          id: activity.id,
          type: "activity",
          eventType: activity.type,
          title: activity.title,
          description: activity.description,
          createdAt: activity.createdAt,
          user: activity.user,
          activityType: activity.type,
          activityStatus: activity.status,
          metadata: {
            priority: activity.priority,
            dueDate: activity.dueDate,
            callDuration: activity.callDuration,
            callOutcome: activity.callOutcome,
            meetingLocation: activity.meetingLocation,
            meetingLink: activity.meetingLink,
          },
        });
      });
    }

    // Get history (unless filter is "activities")
    if (filter !== "activities") {
      const history = await prisma.contactHistory.findMany({
        where: { rowId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      history.forEach((entry) => {
        // Skip if this is an activity-related history entry and we already have it
        if (filter !== "changes" && entry.activityId) {
          return;
        }

        timeline.push({
          id: entry.id,
          type: "history",
          eventType: entry.eventType,
          title: entry.title,
          description: entry.description,
          createdAt: entry.createdAt,
          user: entry.user,
          fieldName: entry.fieldName,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          metadata: entry.metadata as Record<string, unknown>,
        });
      });
    }

    // Sort by date descending
    timeline.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const paginatedTimeline = timeline.slice(offset, offset + limit);

    // Group by date
    const grouped: Record<string, TimelineEntry[]> = {};
    paginatedTimeline.forEach((entry) => {
      const date = entry.createdAt.toISOString().split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(entry);
    });

    // Get summary stats
    const stats = {
      totalActivities: await prisma.activity.count({ where: { rowId } }),
      totalChanges: await prisma.contactHistory.count({ where: { rowId } }),
      lastActivity: timeline.find((t) => t.type === "activity")?.createdAt || null,
      hasDeal: !!row.deal,
      dealStage: row.deal?.stage.name || null,
    };

    return NextResponse.json({
      timeline: paginatedTimeline,
      grouped,
      total: timeline.length,
      hasMore: offset + paginatedTimeline.length < timeline.length,
      stats,
    });
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
