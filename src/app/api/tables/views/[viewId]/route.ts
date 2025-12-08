import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

type Params = Promise<{ viewId: string }>;

// GET /api/tables/views/[viewId] - Get a single view
export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { viewId } = await context.params;

    const view = await prisma.tableView.findFirst({
      where: {
        id: viewId,
        table: {
          project: { userId: session.user.id },
        },
      },
    });

    if (!view) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    return NextResponse.json(view);
  } catch (error) {
    console.error("Error fetching view:", error);
    return NextResponse.json(
      { error: "Failed to fetch view" },
      { status: 500 }
    );
  }
}

// Validation schema for updating a view
const updateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  filters: z.array(z.any()).optional(),
  sorting: z.array(z.any()).optional(),
  columnVisibility: z.record(z.string(), z.boolean()).optional(),
  columnOrder: z.array(z.string()).optional(),
  globalFilter: z.string().optional(),
});

// PATCH /api/tables/views/[viewId] - Update a view
export async function PATCH(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { viewId } = await context.params;
    const body = await request.json();

    // Validate request body
    const validation = updateViewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verify user owns the view
    const existingView = await prisma.tableView.findFirst({
      where: {
        id: viewId,
        table: {
          project: { userId: session.user.id },
        },
      },
    });

    if (!existingView) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    const { isDefault, name, filters, sorting, columnVisibility, columnOrder, globalFilter } = validation.data;

    // If setting as default, unset any existing default
    if (isDefault === true) {
      await prisma.tableView.updateMany({
        where: { tableId: existingView.tableId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Build update data object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (filters !== undefined) updateData.filters = filters;
    if (sorting !== undefined) updateData.sorting = sorting;
    if (columnVisibility !== undefined) updateData.columnVisibility = columnVisibility;
    if (columnOrder !== undefined) updateData.columnOrder = columnOrder;
    if (globalFilter !== undefined) updateData.globalFilter = globalFilter;

    const view = await prisma.tableView.update({
      where: { id: viewId },
      data: updateData,
    });

    return NextResponse.json(view);
  } catch (error) {
    console.error("Error updating view:", error);
    return NextResponse.json(
      { error: "Failed to update view" },
      { status: 500 }
    );
  }
}

// DELETE /api/tables/views/[viewId] - Delete a view
export async function DELETE(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { viewId } = await context.params;

    // Verify user owns the view
    const view = await prisma.tableView.findFirst({
      where: {
        id: viewId,
        table: {
          project: { userId: session.user.id },
        },
      },
    });

    if (!view) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    await prisma.tableView.delete({
      where: { id: viewId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting view:", error);
    return NextResponse.json(
      { error: "Failed to delete view" },
      { status: 500 }
    );
  }
}
