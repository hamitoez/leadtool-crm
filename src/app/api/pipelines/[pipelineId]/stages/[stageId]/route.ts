import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  stageType: z.enum(["OPEN", "WON", "LOST"]).optional(),
  autoMoveAfterDays: z.number().int().min(1).nullable().optional(),
});

// Helper to verify stage access
async function verifyStageAccess(stageId: string, pipelineId: string, userId: string) {
  return prisma.pipelineStage.findFirst({
    where: {
      id: stageId,
      pipelineId,
      pipeline: { project: { userId } },
    },
  });
}

// GET /api/pipelines/[pipelineId]/stages/[stageId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string; stageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pipelineId, stageId } = await params;
    const stage = await verifyStageAccess(stageId, pipelineId, session.user.id);

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const fullStage = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
      include: {
        deals: {
          orderBy: { position: "asc" },
          include: {
            row: {
              include: {
                cells: { include: { column: true } },
              },
            },
          },
        },
        _count: { select: { deals: true } },
      },
    });

    return NextResponse.json(fullStage);
  } catch (error) {
    console.error("Error fetching stage:", error);
    return NextResponse.json({ error: "Failed to fetch stage" }, { status: 500 });
  }
}

// PATCH /api/pipelines/[pipelineId]/stages/[stageId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string; stageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pipelineId, stageId } = await params;
    const stage = await verifyStageAccess(stageId, pipelineId, session.user.id);

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateStageSchema.parse(body);

    const updated = await prisma.pipelineStage.update({
      where: { id: stageId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating stage:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 });
  }
}

// DELETE /api/pipelines/[pipelineId]/stages/[stageId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string; stageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pipelineId, stageId } = await params;
    const stage = await verifyStageAccess(stageId, pipelineId, session.user.id);

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    // Check if stage has deals
    const dealCount = await prisma.deal.count({
      where: { stageId },
    });

    if (dealCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete stage with deals. Move deals first." },
        { status: 400 }
      );
    }

    await prisma.pipelineStage.delete({
      where: { id: stageId },
    });

    // Reorder remaining stages
    const remainingStages = await prisma.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { position: "asc" },
    });

    await Promise.all(
      remainingStages.map((s, index) =>
        prisma.pipelineStage.update({
          where: { id: s.id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting stage:", error);
    return NextResponse.json({ error: "Failed to delete stage" }, { status: 500 });
  }
}
