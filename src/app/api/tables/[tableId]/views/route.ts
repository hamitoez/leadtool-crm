import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

type Params = Promise<{ tableId: string }>;

// GET /api/tables/[tableId]/views - Get all views for a table
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

    // Verify user owns the table
    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        project: { userId: session.user.id },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const views = await prisma.tableView.findMany({
      where: { tableId },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(views);
  } catch (error) {
    console.error("Error fetching views:", error);
    return NextResponse.json(
      { error: "Failed to fetch views" },
      { status: 500 }
    );
  }
}

// Validation schema for creating a view
const createViewSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  isDefault: z.boolean().optional().default(false),
  filters: z.array(z.any()).optional().default([]),
  sorting: z.array(z.any()).optional().default([]),
  columnVisibility: z.record(z.string(), z.boolean()).optional().default({}),
  columnOrder: z.array(z.string()).optional().default([]),
  globalFilter: z.string().optional().default(""),
});

// POST /api/tables/[tableId]/views - Create a new view
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
    const validation = createViewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verify user owns the table
    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        project: { userId: session.user.id },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { name, isDefault, filters, sorting, columnVisibility, columnOrder, globalFilter } = validation.data;

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.tableView.updateMany({
        where: { tableId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const view = await prisma.tableView.create({
      data: {
        tableId,
        name,
        isDefault,
        filters,
        sorting,
        columnVisibility,
        columnOrder,
        globalFilter,
      },
    });

    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    console.error("Error creating view:", error);
    return NextResponse.json(
      { error: "Failed to create view" },
      { status: 500 }
    );
  }
}
