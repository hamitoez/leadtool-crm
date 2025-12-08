import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

type Params = Promise<{ tableId: string }>;

// Validation schema for column reorder
const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string()).min(1, "At least one column ID is required"),
});

// POST - Reorder columns
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
    const validation = reorderColumnsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { columnIds } = validation.data;

    // Check table exists and user has access
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        project: {
          select: { userId: true },
        },
        columns: {
          select: { id: true },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify all column IDs belong to this table
    const existingColumnIds = new Set(table.columns.map((c) => c.id));
    const invalidIds = columnIds.filter((id) => !existingColumnIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Some column IDs don't belong to this table", invalidIds },
        { status: 400 }
      );
    }

    // Update column positions in a transaction
    await prisma.$transaction(
      columnIds.map((columnId, index) =>
        prisma.column.update({
          where: { id: columnId },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: "Column order updated successfully",
    });
  } catch (error) {
    console.error("Error reordering columns:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
