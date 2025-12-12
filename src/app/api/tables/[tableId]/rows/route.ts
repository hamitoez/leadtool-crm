import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { CellData, JsonValue } from "@/types/table";

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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "0");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

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

    // Fetch rows with cells
    const [rows, totalCount] = await Promise.all([
      prisma.row.findMany({
        where: { tableId },
        include: {
          cells: {
            include: {
              column: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: { position: "asc" },
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.row.count({ where: { tableId } }),
    ]);

    // Format response
    const formattedRows = rows.map((row) => ({
      id: row.id,
      position: row.position,
      isFavorite: row.isFavorite,
      notes: row.notes,
      cells: row.cells.reduce(
        (acc, cell) => {
          acc[cell.columnId] = {
            id: cell.id,
            rowId: cell.rowId,
            columnId: cell.columnId,
            value: cell.value,
            metadata: cell.metadata as Record<string, JsonValue>,
            createdAt: cell.createdAt,
            updatedAt: cell.updatedAt,
          };
          return acc;
        },
        {} as Record<string, CellData>
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json({
      rows: formattedRows,
      totalCount,
      pageIndex: page,
      pageSize,
    });
  } catch (error) {
    console.error("Error fetching rows:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
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
        columns: true,
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get next position
    const lastRow = await prisma.row.findFirst({
      where: { tableId },
      orderBy: { position: "desc" },
    });

    const nextPosition = (lastRow?.position ?? -1) + 1;

    // Create row with cells for all columns
    const row = await prisma.row.create({
      data: {
        tableId,
        position: nextPosition,
        cells: {
          create: table.columns.map((column) => ({
            column: {
              connect: {
                id: column.id,
              },
            },
            value: Prisma.JsonNull,
            metadata: {},
          })),
        },
      },
      include: {
        cells: true,
      },
    });

    // Format response
    const formattedRow = {
      id: row.id,
      position: row.position,
      isFavorite: row.isFavorite,
      notes: row.notes,
      cells: row.cells.reduce(
        (acc, cell) => {
          acc[cell.columnId] = {
            id: cell.id,
            rowId: cell.rowId,
            columnId: cell.columnId,
            value: cell.value,
            metadata: cell.metadata as Record<string, JsonValue>,
            createdAt: cell.createdAt,
            updatedAt: cell.updatedAt,
          };
          return acc;
        },
        {} as Record<string, CellData>
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return NextResponse.json({ row: formattedRow }, { status: 201 });
  } catch (error) {
    console.error("Error creating row:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
