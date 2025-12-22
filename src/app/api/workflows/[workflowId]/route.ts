import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ workflowId: string }>;
}

// GET - Get a single workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workflowId } = await params;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: {
          orderBy: { createdAt: "asc" },
        },
        edges: true,
        executions: {
          take: 10,
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow nicht gefunden" },
        { status: 404 }
      );
    }

    if (workflow.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Workflows" },
      { status: 500 }
    );
  }
}

// PATCH - Update a workflow
const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
  pipelineId: z.string().nullable().optional(),
  nodes: z
    .array(
      z.object({
        id: z.string().optional(),
        nodeType: z.enum(["TRIGGER", "ACTION", "CONDITION", "DELAY"]),
        subType: z.string(),
        label: z.string().nullable().optional(),
        positionX: z.number(),
        positionY: z.number(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  edges: z
    .array(
      z.object({
        id: z.string().optional(),
        sourceNodeId: z.string(),
        targetNodeId: z.string(),
        sourceHandle: z.string().nullable().optional(),
        targetHandle: z.string().nullable().optional(),
        label: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workflowId } = await params;

    // Check ownership
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { userId: true },
    });

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: "Workflow nicht gefunden" },
        { status: 404 }
      );
    }

    if (existingWorkflow.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateWorkflowSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.viewport !== undefined) updateData.viewport = data.viewport;
    if (data.pipelineId !== undefined) updateData.pipelineId = data.pipelineId;

    // If nodes are provided, replace all nodes
    if (data.nodes !== undefined) {
      // Delete existing nodes (edges will be cascade deleted)
      await prisma.workflowNode.deleteMany({
        where: { workflowId },
      });

      // Create new nodes
      if (data.nodes.length > 0) {
        // Create a mapping from temp IDs to real IDs
        const nodeIdMap = new Map<string, string>();

        for (const node of data.nodes) {
          const createdNode = await prisma.workflowNode.create({
            data: {
              workflowId,
              nodeType: node.nodeType,
              subType: node.subType,
              label: node.label,
              positionX: node.positionX,
              positionY: node.positionY,
              config: (node.config as object) || {},
            },
          });
          if (node.id) {
            nodeIdMap.set(node.id, createdNode.id);
          }
        }

        // Create edges with mapped IDs
        if (data.edges && data.edges.length > 0) {
          for (const edge of data.edges) {
            const sourceId = nodeIdMap.get(edge.sourceNodeId) || edge.sourceNodeId;
            const targetId = nodeIdMap.get(edge.targetNodeId) || edge.targetNodeId;

            await prisma.workflowEdge.create({
              data: {
                workflowId,
                sourceNodeId: sourceId,
                targetNodeId: targetId,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
                label: edge.label,
              },
            });
          }
        }
      }
    }

    // Update workflow metadata
    const workflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: updateData,
      include: {
        nodes: {
          orderBy: { createdAt: "asc" },
        },
        edges: true,
      },
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("Error updating workflow:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Workflows" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a workflow
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workflowId } = await params;

    // Check ownership
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { userId: true },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow nicht gefunden" },
        { status: 404 }
      );
    }

    if (workflow.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.workflow.delete({
      where: { id: workflowId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Fehler beim Loeschen des Workflows" },
      { status: 500 }
    );
  }
}
