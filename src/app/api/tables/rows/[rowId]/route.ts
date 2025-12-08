import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

type Params = Promise<{ rowId: string }>;

// Validation schema for row updates
const updateRowSchema = z.object({
  position: z.number().min(0).optional(),
});

// GET - Get row details
export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rowId } = await context.params;

    const row = await prisma.row.findUnique({
      where: { id: rowId },
      include: {
        table: {
          include: {
            project: {
              select: { userId: true },
            },
          },
        },
        cells: {
          include: {
            column: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    if (row.table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      row: {
        id: row.id,
        position: row.position,
        cells: row.cells.reduce(
          (acc, cell) => {
            acc[cell.columnId] = {
              id: cell.id,
              rowId: cell.rowId,
              columnId: cell.columnId,
              value: cell.value,
              metadata: cell.metadata,
              createdAt: cell.createdAt,
              updatedAt: cell.updatedAt,
            };
            return acc;
          },
          {} as Record<string, unknown>
        ),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching row:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update row (currently just position)
export async function PATCH(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rowId } = await context.params;
    const body = await request.json();

    // Validate request body
    const validation = updateRowSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Check row exists and user has access
    const row = await prisma.row.findUnique({
      where: { id: rowId },
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

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    if (row.table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Handle position update (reorder rows)
    if (updates.position !== undefined && updates.position !== row.position) {
      const tableId = row.tableId;
      const oldPosition = row.position;
      const newPosition = updates.position;

      // Shift other rows
      if (newPosition < oldPosition) {
        // Moving up: shift rows in between down
        await prisma.row.updateMany({
          where: {
            tableId,
            position: {
              gte: newPosition,
              lt: oldPosition,
            },
          },
          data: {
            position: { increment: 1 },
          },
        });
      } else {
        // Moving down: shift rows in between up
        await prisma.row.updateMany({
          where: {
            tableId,
            position: {
              gt: oldPosition,
              lte: newPosition,
            },
          },
          data: {
            position: { decrement: 1 },
          },
        });
      }
    }

    // Update the row
    const updatedRow = await prisma.row.update({
      where: { id: rowId },
      data: {
        ...(updates.position !== undefined && { position: updates.position }),
      },
    });

    return NextResponse.json({
      row: {
        id: updatedRow.id,
        position: updatedRow.position,
        updatedAt: updatedRow.updatedAt,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error updating row:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete row
export async function DELETE(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rowId } = await context.params;

    // Check row exists and user has access
    const row = await prisma.row.findUnique({
      where: { id: rowId },
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

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    if (row.table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tableId = row.tableId;
    const deletedPosition = row.position;

    // Delete the row (cells will cascade delete)
    await prisma.row.delete({
      where: { id: rowId },
    });

    // Reorder remaining rows
    await prisma.row.updateMany({
      where: {
        tableId,
        position: { gt: deletedPosition },
      },
      data: {
        position: { decrement: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Row deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting row:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
