import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createStageSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  stageType: z.enum(["OPEN", "WON", "LOST"]).optional(),
  position: z.number().int().min(0).optional(),
});

// Helper to verify pipeline access
async function verifyPipelineAccess(pipelineId: string, userId: string) {
  return prisma.pipeline.findFirst({
    where: {
      id: pipelineId,
      project: { userId },
    },
  });
}

// POST /api/pipelines/[pipelineId]/stages - Create a new stage
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
    const pipeline = await verifyPipelineAccess(pipelineId, session.user.id);

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = createStageSchema.parse(body);

    // Get max position if not specified
    let position = data.position;
    if (position === undefined) {
      const maxStage = await prisma.pipelineStage.findFirst({
        where: { pipelineId },
        orderBy: { position: "desc" },
      });
      position = (maxStage?.position ?? -1) + 1;
    } else {
      // Shift existing stages if inserting at position
      await prisma.pipelineStage.updateMany({
        where: {
          pipelineId,
          position: { gte: position },
        },
        data: {
          position: { increment: 1 },
        },
      });
    }

    const stage = await prisma.pipelineStage.create({
      data: {
        pipelineId,
        name: data.name,
        color: data.color ?? "#6B7280",
        stageType: data.stageType ?? "OPEN",
        position,
      },
    });

    return NextResponse.json(stage, { status: 201 });
  } catch (error) {
    console.error("Error creating stage:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create stage" }, { status: 500 });
  }
}
