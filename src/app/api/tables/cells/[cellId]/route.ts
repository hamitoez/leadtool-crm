import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JsonValue } from "@/types/table";

type Params = Promise<{ cellId: string }>;

export async function PATCH(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cellId } = await context.params;
    const body = await request.json();
    const { value, metadata } = body;

    // Check authorization
    const cell = await prisma.cell.findUnique({
      where: { id: cellId },
      include: {
        row: {
          include: {
            table: {
              include: {
                project: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cell) {
      return NextResponse.json({ error: "Cell not found" }, { status: 404 });
    }

    if (cell.row.table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update cell
    const updatedCell = await prisma.cell.update({
      where: { id: cellId },
      data: {
        value: value !== undefined ? value : cell.value,
        metadata: metadata ? { ...(cell.metadata as Record<string, JsonValue>), ...metadata } : cell.metadata,
      },
    });

    return NextResponse.json({
      cell: {
        id: updatedCell.id,
        rowId: updatedCell.rowId,
        columnId: updatedCell.columnId,
        value: updatedCell.value,
        metadata: updatedCell.metadata,
        createdAt: updatedCell.createdAt,
        updatedAt: updatedCell.updatedAt,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error updating cell:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cellId } = await context.params;

    // Check authorization
    const cell = await prisma.cell.findUnique({
      where: { id: cellId },
      include: {
        row: {
          include: {
            table: {
              include: {
                project: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
        },
        column: true,
      },
    });

    if (!cell) {
      return NextResponse.json({ error: "Cell not found" }, { status: 404 });
    }

    if (cell.row.table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      cell: {
        id: cell.id,
        rowId: cell.rowId,
        columnId: cell.columnId,
        value: cell.value,
        metadata: cell.metadata,
        createdAt: cell.createdAt,
        updatedAt: cell.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching cell:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
