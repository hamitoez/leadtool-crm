import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// GET - List all workflows for the user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflows = await prisma.workflow.findMany({
      where: { userId: session.user.id },
      include: {
        nodes: true,
        edges: true,
        _count: {
          select: { executions: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("Error fetching workflows:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Workflows" },
      { status: 500 }
    );
  }
}

// POST - Create a new workflow
const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  pipelineId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createWorkflowSchema.parse(body);

    // Create workflow with a default trigger node
    const workflow = await prisma.workflow.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        pipelineId: data.pipelineId,
        nodes: {
          create: [
            {
              nodeType: "TRIGGER",
              subType: "MANUAL",
              label: "Start",
              positionX: 100,
              positionY: 200,
              config: {},
            },
          ],
        },
      },
      include: {
        nodes: true,
        edges: true,
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    console.error("Error creating workflow:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Workflows" },
      { status: 500 }
    );
  }
}
