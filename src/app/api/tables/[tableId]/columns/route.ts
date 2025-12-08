import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { ColumnType, Prisma } from "@prisma/client";

type Params = Promise<{ tableId: string }>;

// Validation schema for new column
const createColumnSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(ColumnType),
  width: z.number().min(50).max(1000).optional().default(200),
  config: z.record(z.string(), z.unknown()).optional(),
});

// GET - List columns for a table
export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await context.params;

    // Check authorization
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        project: {
          select: { userId: true },
        },
        columns: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      columns: table.columns.map((col) => ({
        id: col.id,
        name: col.name,
        type: col.type,
        position: col.position,
        width: col.width,
        isVisible: col.isVisible,
        isPinned: col.isPinned,
        config: col.config,
        aiConfig: col.aiConfig,
        createdAt: col.createdAt,
        updatedAt: col.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching columns:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new column
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
    const validation = createColumnSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, type, width, config } = validation.data;

    // Check authorization
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        project: {
          select: { userId: true },
        },
        columns: {
          select: { position: true },
          orderBy: { position: "desc" },
          take: 1,
        },
        rows: {
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

    // Get next position
    const nextPosition = (table.columns[0]?.position ?? -1) + 1;

    // Create column and cells for all existing rows in a transaction
    const column = await prisma.$transaction(async (tx) => {
      // Create the column
      const newColumn = await tx.column.create({
        data: {
          tableId,
          name,
          type,
          position: nextPosition,
          width: width ?? 200,
          config: (config ?? {}) as Prisma.InputJsonValue,
        },
      });

      // Create cells for all existing rows
      if (table.rows.length > 0) {
        await tx.cell.createMany({
          data: table.rows.map((row) => ({
            rowId: row.id,
            columnId: newColumn.id,
            value: Prisma.JsonNull,
            metadata: {} as Prisma.InputJsonValue,
          })),
        });
      }

      return newColumn;
    });

    return NextResponse.json(
      {
        column: {
          id: column.id,
          name: column.name,
          type: column.type,
          position: column.position,
          width: column.width,
          isVisible: column.isVisible,
          isPinned: column.isPinned,
          config: column.config,
          createdAt: column.createdAt,
        },
        success: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
