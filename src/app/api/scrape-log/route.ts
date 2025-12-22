import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ScrapeLogStatus } from "@prisma/client";

// Validation schema for creating a scrape log
const createScrapeLogSchema = z.object({
  projectId: z.string(),
  tableId: z.string().optional(),
  rowId: z.string().optional(),
  url: z.string().url(),
  status: z.nativeEnum(ScrapeLogStatus),
  error: z.string().optional(),
  foundData: z.record(z.string(), z.any()).optional(),
  pagesScraped: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  processingTime: z.number().optional(),
});

/**
 * GET /api/scrape-log - Get scrape logs for a project
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status") as ScrapeLogStatus | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or unauthorized" },
        { status: 404 }
      );
    }

    // Build where clause
    const where: { projectId: string; status?: ScrapeLogStatus } = { projectId };
    if (status) {
      where.status = status;
    }

    // Get scrape logs with pagination
    const [logs, total] = await Promise.all([
      prisma.scrapeLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.scrapeLog.count({ where }),
    ]);

    // Get status counts for the project
    const statusCounts = await prisma.scrapeLog.groupBy({
      by: ["status"],
      where: { projectId },
      _count: true,
    });

    const counts = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
      counts,
    });
  } catch (error) {
    console.error("Error fetching scrape logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch scrape logs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scrape-log - Create a new scrape log entry
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createScrapeLogSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or unauthorized" },
        { status: 404 }
      );
    }

    // Normalize URL for deduplication
    let normalizedUrl = data.url;
    try {
      const urlObj = new URL(data.url);
      normalizedUrl = urlObj.hostname + urlObj.pathname.replace(/\/$/, "");
    } catch {
      // Keep original URL if parsing fails
    }

    // Create scrape log entry
    const scrapeLog = await prisma.scrapeLog.create({
      data: {
        projectId: data.projectId,
        tableId: data.tableId,
        rowId: data.rowId,
        url: data.url,
        normalizedUrl,
        status: data.status,
        error: data.error,
        foundData: data.foundData || {},
        pagesScraped: data.pagesScraped || [],
        confidence: data.confidence || 0,
        processingTime: data.processingTime,
      },
    });

    return NextResponse.json({
      success: true,
      data: scrapeLog,
    });
  } catch (error) {
    console.error("Error creating scrape log:", error);
    return NextResponse.json(
      { error: "Failed to create scrape log" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scrape-log - Delete scrape log entries
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const logId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or unauthorized" },
        { status: 404 }
      );
    }

    if (deleteAll) {
      // Delete all logs for this project
      const result = await prisma.scrapeLog.deleteMany({
        where: { projectId },
      });
      return NextResponse.json({
        success: true,
        deleted: result.count,
      });
    } else if (logId) {
      // Delete specific log
      await prisma.scrapeLog.delete({
        where: { id: logId, projectId },
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Either id or all=true is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error deleting scrape log:", error);
    return NextResponse.json(
      { error: "Failed to delete scrape log" },
      { status: 500 }
    );
  }
}
