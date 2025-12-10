import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JsonValue } from "@/types/table";
import { z } from "zod";
import { Prisma } from "@prisma/client";

type Params = Promise<{ cellId: string }>;

// Validation schema for cell updates
const cellUpdateSchema = z.object({
  value: z.union([
    z.string().max(100000), // Text content up to 100KB
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()), // For multi-select
  ]).optional(),
  metadata: z.object({
    source: z.string().max(100).optional(),
    scrapedAt: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    confidence: z.number().min(0).max(1).optional(),
    aiGenerated: z.boolean().optional(),
  }).passthrough().optional(),
});

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

    // Validate request body
    const body = await request.json();
    const validation = cellUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { value, metadata } = validation.data;

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
        value: value !== undefined ? (value as Prisma.InputJsonValue) : (cell.value as Prisma.InputJsonValue),
        metadata: metadata ? { ...(cell.metadata as Record<string, JsonValue>), ...metadata } as Prisma.InputJsonValue : (cell.metadata as Prisma.InputJsonValue),
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
