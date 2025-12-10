import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Validation schema for table updates
const tableUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  settings: z.object({
    defaultView: z.enum(["table", "kanban", "calendar"]).optional(),
    rowHeight: z.enum(["compact", "default", "expanded"]).optional(),
    showLineNumbers: z.boolean().optional(),
    enableFilters: z.boolean().optional(),
    enableSorting: z.boolean().optional(),
  }).passthrough().nullable().optional(),
});

type Params = Promise<{ tableId: string }>;

export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await context.params;

    // Fetch table with columns
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        columns: {
          orderBy: { position: "asc" },
        },
        project: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            rows: true,
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Check authorization
    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Format response
    const response = {
      table: {
        id: table.id,
        name: table.name,
        description: table.description,
        projectId: table.projectId,
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
        })),
        settings: table.settings,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      },
      totalRows: table._count.rows,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching table:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await context.params;

    // Validate request body
    const body = await request.json();
    const validation = tableUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, settings } = validation.data;

    // Check authorization
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        project: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update table with validated data
    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(settings && { settings: settings as Prisma.InputJsonValue }),
      },
    });

    return NextResponse.json({ table: updatedTable });
  } catch (error) {
    console.error("Error updating table:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await context.params;

    // Check authorization
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        project: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete table (cascades to columns, rows, cells)
    await prisma.table.delete({
      where: { id: tableId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting table:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
