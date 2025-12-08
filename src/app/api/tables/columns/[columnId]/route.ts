import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { ColumnType, Prisma } from "@prisma/client";

type Params = Promise<{ columnId: string }>;

// Validation schema for column updates
const updateColumnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.nativeEnum(ColumnType).optional(),
  width: z.number().min(50).max(1000).optional(),
  isVisible: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  position: z.number().min(0).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// GET - Get column details
export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { columnId } = await context.params;

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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      column: {
        id: column.id,
        name: column.name,
        type: column.type,
        position: column.position,
        width: column.width,
        isVisible: column.isVisible,
        isPinned: column.isPinned,
        config: column.config,
        aiConfig: column.aiConfig,
        createdAt: column.createdAt,
        updatedAt: column.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update column
export async function PATCH(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { columnId } = await context.params;
    const body = await request.json();

    // Validate request body
    const validation = updateColumnSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Check column exists and user has access
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Handle position update (reorder columns)
    if (updates.position !== undefined && updates.position !== column.position) {
      const tableId = column.tableId;
      const oldPosition = column.position;
      const newPosition = updates.position;

      // Shift other columns
      if (newPosition < oldPosition) {
        // Moving up: shift columns in between down
        await prisma.column.updateMany({
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
        // Moving down: shift columns in between up
        await prisma.column.updateMany({
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

    // Update the column
    const updatedColumn = await prisma.column.update({
      where: { id: columnId },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.type !== undefined && { type: updates.type }),
        ...(updates.width !== undefined && { width: updates.width }),
        ...(updates.isVisible !== undefined && { isVisible: updates.isVisible }),
        ...(updates.isPinned !== undefined && { isPinned: updates.isPinned }),
        ...(updates.position !== undefined && { position: updates.position }),
        ...(updates.config !== undefined && { config: updates.config as Prisma.InputJsonValue }),
      },
    });

    return NextResponse.json({
      column: {
        id: updatedColumn.id,
        name: updatedColumn.name,
        type: updatedColumn.type,
        position: updatedColumn.position,
        width: updatedColumn.width,
        isVisible: updatedColumn.isVisible,
        isPinned: updatedColumn.isPinned,
        config: updatedColumn.config,
        updatedAt: updatedColumn.updatedAt,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error updating column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete column
export async function DELETE(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { columnId } = await context.params;

    // Check column exists and user has access
    const column = await prisma.column.findUnique({
      where: { id: columnId },
      include: {
        table: {
          include: {
            project: {
              select: { userId: true },
            },
            columns: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    if (column.table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Don't allow deleting the last column
    if (column.table.columns.length <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last column in a table" },
        { status: 400 }
      );
    }

    const tableId = column.tableId;
    const deletedPosition = column.position;

    // Delete the column (cells will cascade delete)
    await prisma.column.delete({
      where: { id: columnId },
    });

    // Reorder remaining columns
    await prisma.column.updateMany({
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
      message: "Column deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
