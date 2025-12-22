import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/rows/[rowId]/history - Get contact history for a row
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
    const eventType = searchParams.get("eventType");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

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
    if (eventType) where.eventType = eventType;

    const [history, total] = await Promise.all([
      prisma.contactHistory.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.contactHistory.count({ where }),
    ]);

    // Group by date
    const grouped: Record<string, typeof history> = {};
    history.forEach((entry) => {
      const date = entry.createdAt.toISOString().split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(entry);
    });

    return NextResponse.json({
      history,
      grouped,
      total,
      hasMore: offset + history.length < total,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
