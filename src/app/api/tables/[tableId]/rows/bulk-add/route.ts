import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

type Params = Promise<{ tableId: string }>;

interface RowInput {
  [columnId: string]: string;
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
    const body = await request.json();
    const { rows } = body as { rows: RowInput[] };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided" },
        { status: 400 }
      );
    }

    // Limit to 100 rows at a time
    if (rows.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 rows at a time" },
        { status: 400 }
      );
    }

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

    let nextPosition = (lastRow?.position ?? -1) + 1;

    // Create all rows in a transaction
    const createdRows = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const rowData of rows) {
        // Create row
        const row = await tx.row.create({
          data: {
            tableId,
            position: nextPosition++,
          },
        });

        // Create cells for all columns
        const cellsToCreate = table.columns.map((column) => {
          const value = rowData[column.id];
          return {
            rowId: row.id,
            columnId: column.id,
            value: value !== undefined && value !== ""
              ? value
              : Prisma.JsonNull,
            metadata: {},
          };
        });

        await tx.cell.createMany({
          data: cellsToCreate,
        });

        results.push(row);
      }

      return results;
    });

    return NextResponse.json(
      {
        count: createdRows.length,
        message: `${createdRows.length} row(s) created successfully`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating rows:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
