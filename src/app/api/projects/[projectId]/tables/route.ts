import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createTableSchema } from "@/lib/validations/project";

type Params = Promise<{ projectId: string }>;

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

    const { projectId } = await context.params;

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

    const tables = await prisma.table.findMany({
      where: {
        projectId,
      },
      include: {
        _count: {
          select: {
            rows: true,
            columns: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(tables);
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
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

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { projectId } = await context.params;

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

    const body = await request.json();
    const validatedData = createTableSchema.parse(body);

    // Create table with a default "Name" column
    const table = await prisma.table.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        projectId,
        columns: {
          create: {
            name: "Name",
            type: "TEXT",
            position: 0,
            width: 250,
            isVisible: true,
            isPinned: true,
          },
        },
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

    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    console.error("Error creating table:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}
