import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updatePipelineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
});

// Helper to verify pipeline access
async function verifyPipelineAccess(pipelineId: string, userId: string) {
  const pipeline = await prisma.pipeline.findFirst({
    where: {
      id: pipelineId,
      project: { userId },
    },
    include: { project: true },
  });
  return pipeline;
}

// GET /api/pipelines/[pipelineId] - Get pipeline with stages and deals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pipelineId } = await params;
    const pipeline = await verifyPipelineAccess(pipelineId, session.user.id);

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const fullPipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { position: "asc" },
          include: {
            deals: {
              orderBy: { position: "asc" },
              include: {
                row: {
                  include: {
                    cells: {
                      include: { column: true },
                    },
                    activities: {
                      where: {
                        type: "TASK",
                        status: "PLANNED",
                      },
                      orderBy: { dueDate: "asc" },
                      take: 1,
                    },
                  },
                },
              },
            },
            _count: { select: { deals: true } },
          },
        },
      },
    });

    // Calculate stats
    const stats = {
      totalDeals: 0,
      totalValue: 0,
      weightedValue: 0,
      byStage: {} as Record<string, { count: number; value: number }>,
    };

    fullPipeline?.stages.forEach((stage) => {
      const stageValue = stage.deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      const stageWeightedValue = stage.deals.reduce(
        (sum, deal) => sum + (deal.value || 0) * (deal.probability / 100),
        0
      );

      stats.totalDeals += stage.deals.length;
      stats.totalValue += stageValue;
      stats.weightedValue += stageWeightedValue;
      stats.byStage[stage.id] = {
        count: stage.deals.length,
        value: stageValue,
      };
    });

    return NextResponse.json({ pipeline: fullPipeline, stats });
  } catch (error) {
    console.error("Error fetching pipeline:", error);
    return NextResponse.json({ error: "Failed to fetch pipeline" }, { status: 500 });
  }
}

// PATCH /api/pipelines/[pipelineId] - Update pipeline
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pipelineId } = await params;
    const pipeline = await verifyPipelineAccess(pipelineId, session.user.id);

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updatePipelineSchema.parse(body);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.pipeline.updateMany({
        where: {
          projectId: pipeline.projectId,
          isDefault: true,
          NOT: { id: pipelineId },
        },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.pipeline.update({
      where: { id: pipelineId },
      data,
      include: {
        stages: { orderBy: { position: "asc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating pipeline:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update pipeline" }, { status: 500 });
  }
}

// DELETE /api/pipelines/[pipelineId] - Delete pipeline
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pipelineId } = await params;
    const pipeline = await verifyPipelineAccess(pipelineId, session.user.id);

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    await prisma.pipeline.delete({
      where: { id: pipelineId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pipeline:", error);
    return NextResponse.json({ error: "Failed to delete pipeline" }, { status: 500 });
  }
}
