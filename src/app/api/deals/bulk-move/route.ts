import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const bulkMoveSchema = z.object({
  dealIds: z.array(z.string()),
  stageId: z.string(),
  lostReason: z.string().optional(),
});

// POST /api/deals/bulk-move - Move multiple deals to a stage
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = bulkMoveSchema.parse(body);

    // Verify target stage access
    const targetStage = await prisma.pipelineStage.findFirst({
      where: {
        id: data.stageId,
        pipeline: { project: { userId: session.user.id } },
      },
    });

    if (!targetStage) {
      return NextResponse.json({ error: "Target stage not found" }, { status: 404 });
    }

    // Get all deals and verify access
    const deals = await prisma.deal.findMany({
      where: {
        id: { in: data.dealIds },
        row: { table: { project: { userId: session.user.id } } },
      },
      include: { stage: true },
    });

    if (deals.length !== data.dealIds.length) {
      return NextResponse.json(
        { error: "Some deals not found or not accessible" },
        { status: 404 }
      );
    }

    // Get max position in target stage
    const maxDeal = await prisma.deal.findFirst({
      where: { stageId: data.stageId },
      orderBy: { position: "desc" },
    });

    let nextPosition = (maxDeal?.position ?? -1) + 1;

    // Prepare update data
    const now = new Date();
    const updateData: Record<string, unknown> = {
      stageId: data.stageId,
      stageChangedAt: now,
    };

    if (targetStage.stageType === "WON") {
      updateData.wonAt = now;
      updateData.lostAt = null;
      updateData.lostReason = null;
    } else if (targetStage.stageType === "LOST") {
      updateData.lostAt = now;
      updateData.lostReason = data.lostReason || null;
      updateData.wonAt = null;
    } else {
      updateData.wonAt = null;
      updateData.lostAt = null;
      updateData.lostReason = null;
    }

    // Update all deals in transaction
    const historyEntries: Array<{
      rowId: string;
      userId: string;
      eventType: "STAGE_CHANGED" | "DEAL_WON" | "DEAL_LOST";
      title: string;
      description?: string;
      oldValue: { stageId: string; stageName: string };
      newValue: { stageId: string; stageName: string };
    }> = [];

    await prisma.$transaction(async (tx) => {
      for (const deal of deals) {
        if (deal.stageId !== data.stageId) {
          await tx.deal.update({
            where: { id: deal.id },
            data: {
              ...updateData,
              position: nextPosition++,
            },
          });

          // Track for history
          let eventType: "STAGE_CHANGED" | "DEAL_WON" | "DEAL_LOST" = "STAGE_CHANGED";
          let title = `Stage geändert: ${deal.stage.name} → ${targetStage.name}`;

          if (targetStage.stageType === "WON") {
            eventType = "DEAL_WON";
            title = "Deal gewonnen!";
          } else if (targetStage.stageType === "LOST") {
            eventType = "DEAL_LOST";
            title = "Deal verloren";
          }

          historyEntries.push({
            rowId: deal.rowId,
            userId: session.user.id,
            eventType,
            title,
            description: data.lostReason,
            oldValue: { stageId: deal.stageId, stageName: deal.stage.name },
            newValue: { stageId: targetStage.id, stageName: targetStage.name },
          });
        }
      }
    });

    // Create history entries
    if (historyEntries.length > 0) {
      await prisma.contactHistory.createMany({
        data: historyEntries,
      });
    }

    // Reorder old stages
    const affectedStageIds = [...new Set(deals.map((d) => d.stageId))];
    for (const stageId of affectedStageIds) {
      if (stageId !== data.stageId) {
        const stageDeals = await prisma.deal.findMany({
          where: { stageId },
          orderBy: { position: "asc" },
        });

        await Promise.all(
          stageDeals.map((d, index) =>
            prisma.deal.update({
              where: { id: d.id },
              data: { position: index },
            })
          )
        );
      }
    }

    return NextResponse.json({
      success: true,
      moved: historyEntries.length,
    });
  } catch (error) {
    console.error("Error bulk moving deals:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to move deals" }, { status: 500 });
  }
}
