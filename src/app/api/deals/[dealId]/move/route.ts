import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { onStageChanged } from "@/lib/workflow/trigger";
import { dispatchDealStageChanged, dispatchDealWon, dispatchDealLost } from "@/lib/webhook-dispatcher";

const moveDealSchema = z.object({
  stageId: z.string(),
  position: z.number().int().min(0).optional(),
  lostReason: z.string().optional(), // For moving to LOST stage
});

// POST /api/deals/[dealId]/move - Move deal to another stage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dealId } = await params;

    // Get current deal
    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        row: { table: { project: { userId: session.user.id } } },
      },
      include: {
        stage: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = moveDealSchema.parse(body);

    // Verify target stage access and get pipeline info
    const targetStage = await prisma.pipelineStage.findFirst({
      where: {
        id: data.stageId,
        pipeline: { project: { userId: session.user.id } },
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

    if (!targetStage) {
      return NextResponse.json({ error: "Target stage not found" }, { status: 404 });
    }

    const oldStageId = deal.stageId;
    const oldStageName = deal.stage.name;
    const isStageChange = oldStageId !== data.stageId;

    // Prepare update data
    const updateData: Record<string, unknown> = {
      stageId: data.stageId,
    };

    if (isStageChange) {
      updateData.stageChangedAt = new Date();

      // Handle WON stage
      if (targetStage.stageType === "WON") {
        updateData.wonAt = new Date();
        updateData.lostAt = null;
        updateData.lostReason = null;
      }
      // Handle LOST stage
      else if (targetStage.stageType === "LOST") {
        updateData.lostAt = new Date();
        updateData.lostReason = data.lostReason || null;
        updateData.wonAt = null;
      }
      // Handle moving back to OPEN stage
      else {
        updateData.wonAt = null;
        updateData.lostAt = null;
        updateData.lostReason = null;
      }
    }

    // Calculate new position
    let newPosition = data.position;
    if (newPosition === undefined) {
      const maxDeal = await prisma.deal.findFirst({
        where: { stageId: data.stageId },
        orderBy: { position: "desc" },
      });
      newPosition = (maxDeal?.position ?? -1) + 1;
    } else {
      // Shift deals in target stage
      await prisma.deal.updateMany({
        where: {
          stageId: data.stageId,
          position: { gte: newPosition },
          NOT: { id: dealId },
        },
        data: {
          position: { increment: 1 },
        },
      });
    }

    updateData.position = newPosition;

    // Update deal
    const updated = await prisma.deal.update({
      where: { id: dealId },
      data: updateData,
      include: {
        row: {
          include: {
            cells: { include: { column: true } },
          },
        },
        stage: true,
      },
    });

    // Reorder old stage if stage changed
    if (isStageChange) {
      const oldStageDeals = await prisma.deal.findMany({
        where: { stageId: oldStageId },
        orderBy: { position: "asc" },
      });

      await Promise.all(
        oldStageDeals.map((d, index) =>
          prisma.deal.update({
            where: { id: d.id },
            data: { position: index },
          })
        )
      );

      // Create history entry
      let eventType: "STAGE_CHANGED" | "DEAL_WON" | "DEAL_LOST" = "STAGE_CHANGED";
      let title = `Stage geändert: ${oldStageName} → ${targetStage.name}`;

      if (targetStage.stageType === "WON") {
        eventType = "DEAL_WON";
        title = "Deal gewonnen!";
      } else if (targetStage.stageType === "LOST") {
        eventType = "DEAL_LOST";
        title = "Deal verloren";
      }

      await prisma.contactHistory.create({
        data: {
          rowId: deal.rowId,
          userId: session.user.id,
          eventType,
          title,
          description: data.lostReason || undefined,
          oldValue: { stageId: oldStageId, stageName: oldStageName },
          newValue: { stageId: targetStage.id, stageName: targetStage.name },
          metadata: {
            dealValue: deal.value,
            probability: deal.probability,
          },
        },
      });

      // Trigger STAGE_CHANGED workflows (fire and forget)
      onStageChanged(
        session.user.id,
        dealId,
        deal.rowId,
        targetStage.pipeline.id,
        oldStageId,
        data.stageId
      );

      // Dispatch webhooks (fire and forget)
      const orgId = targetStage.pipeline.project.organizationId;
      if (orgId) {
        if (targetStage.stageType === "WON") {
          dispatchDealWon(orgId, {
            id: deal.id,
            rowId: deal.rowId,
            value: deal.value,
            wonAt: new Date(),
          });
        } else if (targetStage.stageType === "LOST") {
          dispatchDealLost(orgId, {
            id: deal.id,
            rowId: deal.rowId,
            value: deal.value,
            lostAt: new Date(),
            reason: data.lostReason || null,
          });
        } else {
          dispatchDealStageChanged(orgId, {
            id: deal.id,
            rowId: deal.rowId,
            oldStageId,
            oldStageName,
            newStageId: data.stageId,
            newStageName: targetStage.name,
            value: deal.value,
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error moving deal:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to move deal" }, { status: 500 });
  }
}
