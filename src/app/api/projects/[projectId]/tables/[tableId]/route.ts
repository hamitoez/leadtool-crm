import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateTableSchema } from "@/lib/validations/project";

type Params = Promise<{ projectId: string; tableId: string }>;

export async function GET(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { projectId, tableId } = await context.params;

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const table = await prisma.table.findUnique({
      where: {
        id: tableId,
        projectId,
      },
      include: {
        columns: {
          orderBy: {
            position: "asc",
          },
        },
        _count: {
          select: {
            rows: true,
            columns: true,
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(table);
  } catch (error) {
    console.error("Error fetching table:", error);
    return NextResponse.json(
      { error: "Failed to fetch table" },
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

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { projectId, tableId } = await context.params;

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Verify table exists in project
    const existingTable = await prisma.table.findUnique({
      where: {
        id: tableId,
        projectId,
      },
    });

    if (!existingTable) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateTableSchema.parse(body);

    const table = await prisma.table.update({
      where: {
        id: tableId,
      },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
      },
      include: {
        _count: {
          select: {
            rows: true,
            columns: true,
          },
        },
      },
    });

    return NextResponse.json(table);
  } catch (error) {
    console.error("Error updating table:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update table" },
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

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { projectId, tableId } = await context.params;

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Verify table exists in project
    const existingTable = await prisma.table.findUnique({
      where: {
        id: tableId,
        projectId,
      },
    });

    if (!existingTable) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    // Delete table (cascade will delete columns, rows, cells)
    await prisma.table.delete({
      where: {
        id: tableId,
      },
    });

    return NextResponse.json(
      { message: "Table deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting table:", error);
    return NextResponse.json(
      { error: "Failed to delete table" },
      { status: 500 }
    );
  }
}
