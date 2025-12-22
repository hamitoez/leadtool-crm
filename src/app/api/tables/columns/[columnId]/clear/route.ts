import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * POST /api/tables/columns/[columnId]/clear
 * Clear all cell values in a column
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ columnId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { columnId } = await params;

    // Verify column exists and user has access
    const column = await prisma.column.findUnique({
      where: { id: columnId },
      include: {
        table: {
          include: {
            project: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    if (column.table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Clear all cells in this column by setting value to null
    const result = await prisma.cell.updateMany({
      where: {
        columnId: columnId,
      },
      data: {
        value: Prisma.JsonNull,
      },
    });

    return NextResponse.json({
      success: true,
      clearedCount: result.count,
      message: `${result.count} Zellen geleert`,
    });
  } catch (error) {
    console.error("Clear column error:", error);
    return NextResponse.json(
      { error: "Failed to clear column" },
      { status: 500 }
    );
  }
}
