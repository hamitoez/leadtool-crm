import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/projects/[projectId]/rows-without-deals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all rows from project's tables that don't have a deal yet
    const rows = await prisma.row.findMany({
      where: {
        table: { projectId },
        deal: null, // No deal associated
      },
      include: {
        cells: {
          include: {
            column: {
              select: { name: true, type: true },
            },
          },
        },
        table: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit results
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching rows without deals:", error);
    return NextResponse.json(
      { error: "Failed to fetch rows" },
      { status: 500 }
    );
  }
}
