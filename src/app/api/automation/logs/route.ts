import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/automation/logs - Get automation logs
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("ruleId");
    const rowId = searchParams.get("rowId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get user's rules first
    const userRules = await prisma.followUpRule.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const ruleIds = userRules.map((r) => r.id);

    const where: Record<string, unknown> = {
      ruleId: { in: ruleIds },
    };

    if (ruleId) where.ruleId = ruleId;
    if (rowId) where.rowId = rowId;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where,
        orderBy: { executedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.automationLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      hasMore: offset + logs.length < total,
    });
  } catch (error) {
    console.error("Error fetching automation logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
