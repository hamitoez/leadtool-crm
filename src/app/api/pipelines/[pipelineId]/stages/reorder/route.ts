import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const reorderSchema = z.object({
  stageIds: z.array(z.string()),
});

// POST /api/pipelines/[pipelineId]/stages/reorder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pipelineId } = await params;

    // Verify pipeline access
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        project: { userId: session.user.id },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const body = await request.json();
    const { stageIds } = reorderSchema.parse(body);

    // Verify all stages belong to this pipeline
    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId },
    });

    const existingIds = new Set(stages.map((s) => s.id));
    const providedIds = new Set(stageIds);

    if (existingIds.size !== providedIds.size) {
      return NextResponse.json(
        { error: "Stage IDs don't match pipeline stages" },
        { status: 400 }
      );
    }

    for (const id of stageIds) {
      if (!existingIds.has(id)) {
        return NextResponse.json(
          { error: `Stage ${id} not found in pipeline` },
          { status: 400 }
        );
      }
    }

    // Update positions in a transaction
    await prisma.$transaction(
      stageIds.map((id, index) =>
        prisma.pipelineStage.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    const updatedStages = await prisma.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(updatedStages);
  } catch (error) {
    console.error("Error reordering stages:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to reorder stages" }, { status: 500 });
  }
}
