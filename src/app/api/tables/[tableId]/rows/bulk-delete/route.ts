import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

type Params = Promise<{ tableId: string }>;

// Validation schema for bulk delete
const bulkDeleteSchema = z.object({
  rowIds: z.array(z.string()).min(1, "At least one row ID is required"),
});

// POST - Bulk delete rows
export async function POST(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await context.params;
    const body = await request.json();

    // Validate request body
    const validation = bulkDeleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { rowIds } = validation.data;

    // Check table exists and user has access
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        project: {
          select: { userId: true },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify all rows belong to this table
    const rows = await prisma.row.findMany({
      where: {
        id: { in: rowIds },
        tableId: tableId,
      },
      select: { id: true, position: true },
      orderBy: { position: "asc" },
    });

    if (rows.length !== rowIds.length) {
      return NextResponse.json(
        { error: "Some rows were not found or don't belong to this table" },
        { status: 400 }
      );
    }

    // Delete all specified rows in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the rows (cells will cascade delete)
      await tx.row.deleteMany({
        where: {
          id: { in: rowIds },
          tableId: tableId,
        },
      });

      // Recalculate positions for remaining rows
      const remainingRows = await tx.row.findMany({
        where: { tableId: tableId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      // Update positions sequentially
      for (let i = 0; i < remainingRows.length; i++) {
        await tx.row.update({
          where: { id: remainingRows[i].id },
          data: { position: i },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `${rowIds.length} row(s) deleted successfully`,
      deletedCount: rowIds.length,
    });
  } catch (error) {
    console.error("Error bulk deleting rows:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
