import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { onDealCreated } from "@/lib/workflow/trigger";
import { dispatchDealCreated } from "@/lib/webhook-dispatcher";

const createDealSchema = z.object({
  rowId: z.string(),
  stageId: z.string(),
  value: z.number().min(0).nullable().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedClose: z.string().datetime().nullable().optional(),
});

// GET /api/deals - Get all deals (with filters)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");
    const stageId = searchParams.get("stageId");
    const projectId = searchParams.get("projectId");

    // Get user's organization memberships
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    const projectFilter = {
      OR: [
        { userId: session.user.id },
        { organizationId: { in: userOrgIds } },
      ],
    };

    const where: Record<string, unknown> = {
      stage: {
        pipeline: {
          project: projectFilter,
        },
      },
    };

    if (pipelineId) {
      where.stage = { ...where.stage as object, pipelineId };
    }

    if (stageId) {
      where.stageId = stageId;
    }

    if (projectId) {
      where.stage = {
        ...where.stage as object,
        pipeline: { projectId, project: projectFilter },
      };
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        row: {
          include: {
            cells: { include: { column: true } },
            table: { select: { id: true, name: true, projectId: true } },
          },
        },
        stage: {
          select: { id: true, name: true, color: true, stageType: true },
        },
      },
      orderBy: [{ stage: { position: "asc" } }, { position: "asc" }],
    });

    return NextResponse.json(deals);
  } catch (error) {
    console.error("Error fetching deals:", error);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}

// POST /api/deals - Create a new deal (add row to pipeline)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createDealSchema.parse(body);

    // Get user's organization memberships
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    const projectFilter = {
      OR: [
        { userId: session.user.id },
        { organizationId: { in: userOrgIds } },
      ],
    };

    // Verify row access
    const row = await prisma.row.findFirst({
      where: {
        id: data.rowId,
        table: { project: projectFilter },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    // Check if row already has a deal
    const existingDeal = await prisma.deal.findUnique({
      where: { rowId: data.rowId },
    });

    if (existingDeal) {
      return NextResponse.json(
        { error: "Row already has a deal" },
        { status: 400 }
      );
    }

    // Verify stage access and get pipeline info
    const stage = await prisma.pipelineStage.findFirst({
      where: {
        id: data.stageId,
        pipeline: { project: projectFilter },
      },
      include: {
        pipeline: {
          select: {
            id: true,
            project: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    // Get max position in stage
    const maxDeal = await prisma.deal.findFirst({
      where: { stageId: data.stageId },
      orderBy: { position: "desc" },
    });

    const deal = await prisma.deal.create({
      data: {
        rowId: data.rowId,
        stageId: data.stageId,
        value: data.value ?? null,
        probability: data.probability ?? 50,
        expectedClose: data.expectedClose ? new Date(data.expectedClose) : null,
        position: (maxDeal?.position ?? -1) + 1,
      },
      include: {
        row: {
          include: {
            cells: { include: { column: true } },
          },
        },
        stage: true,
      },
    });

    // Create history entry
    await prisma.contactHistory.create({
      data: {
        rowId: data.rowId,
        userId: session.user.id,
        eventType: "DEAL_CREATED",
        title: "Deal erstellt",
        description: `Deal wurde zur Pipeline hinzugefügt (Stage: ${stage.name})`,
        metadata: { stageId: data.stageId, stageName: stage.name },
      },
    });

    // Trigger DEAL_CREATED workflows (fire and forget)
    onDealCreated(
      session.user.id,
      deal.id,
      data.rowId,
      stage.pipeline.id,
      data.stageId
    );

    // Dispatch webhook for deal creation (fire and forget)
    if (stage.pipeline.project.organizationId) {
      dispatchDealCreated(stage.pipeline.project.organizationId, {
        id: deal.id,
        rowId: deal.rowId,
        stageId: deal.stageId,
        stageName: stage.name,
        value: deal.value,
        probability: deal.probability,
      });
    }

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error("Error creating deal:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
  }
}
