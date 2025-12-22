// Auto-Move Engine
// Automatically moves deals to next stage when they've been inactive

import prisma from "@/lib/prisma";
import { onStageChanged } from "@/lib/workflow/trigger";

interface AutoMoveResult {
  processed: number;
  moved: number;
  errors: Array<{ dealId: string; error: string }>;
  details: Array<{
    dealId: string;
    rowId: string;
    fromStage: string;
    toStage: string;
    daysInactive: number;
  }>;
}

/**
 * Check and move stale deals for a specific user
 */
export async function processAutoMoveForUser(userId: string): Promise<AutoMoveResult> {
  const result: AutoMoveResult = {
    processed: 0,
    moved: 0,
    errors: [],
    details: [],
  };

  try {
    // Get all stages with autoMoveAfterDays configured
    const stagesWithAutoMove = await prisma.pipelineStage.findMany({
      where: {
        autoMoveAfterDays: { not: null },
        stageType: "OPEN", // Only auto-move from OPEN stages
        pipeline: {
          project: { userId },
        },
      },
      include: {
        pipeline: {
          include: {
            stages: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    for (const stage of stagesWithAutoMove) {
      if (!stage.autoMoveAfterDays) continue;

      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - stage.autoMoveAfterDays);

      // Find deals that have been in this stage too long
      const staleDeals = await prisma.deal.findMany({
        where: {
          stageId: stage.id,
          stageChangedAt: { lt: cutoffDate },
          // Not already won or lost
          wonAt: null,
          lostAt: null,
        },
        include: {
          row: { select: { id: true } },
        },
      });

      result.processed += staleDeals.length;

      // Find the next stage in the pipeline
      const stageIndex = stage.pipeline.stages.findIndex((s) => s.id === stage.id);
      const nextStage = stage.pipeline.stages[stageIndex + 1];

      if (!nextStage) {
        // No next stage to move to
        continue;
      }

      // Move each stale deal
      for (const deal of staleDeals) {
        try {
          // Calculate days inactive
          const daysInactive = Math.floor(
            (Date.now() - (deal.stageChangedAt?.getTime() || deal.createdAt.getTime())) /
              (1000 * 60 * 60 * 24)
          );

          // Get max position in target stage
          const maxDeal = await prisma.deal.findFirst({
            where: { stageId: nextStage.id },
            orderBy: { position: "desc" },
          });

          // Update deal
          await prisma.deal.update({
            where: { id: deal.id },
            data: {
              stageId: nextStage.id,
              stageChangedAt: new Date(),
              position: (maxDeal?.position ?? -1) + 1,
            },
          });

          // Create history entry
          await prisma.contactHistory.create({
            data: {
              rowId: deal.rowId,
              userId,
              eventType: "STAGE_CHANGED",
              title: `Automatisch verschoben: ${stage.name} → ${nextStage.name}`,
              description: `Deal wurde automatisch verschoben nach ${daysInactive} Tagen Inaktivitaet`,
              oldValue: { stageId: stage.id, stageName: stage.name },
              newValue: { stageId: nextStage.id, stageName: nextStage.name },
              metadata: {
                isAutomatic: true,
                daysInactive,
                autoMoveAfterDays: stage.autoMoveAfterDays,
              },
            },
          });

          // Create notification
          await prisma.notification.create({
            data: {
              userId,
              type: "SYSTEM",
              title: "Deal automatisch verschoben",
              message: `Ein Deal wurde von "${stage.name}" nach "${nextStage.name}" verschoben (${daysInactive} Tage inaktiv)`,
              read: false,
            },
          });

          // Trigger workflow (fire and forget)
          onStageChanged(
            userId,
            deal.id,
            deal.rowId,
            stage.pipelineId,
            stage.id,
            nextStage.id
          );

          result.moved++;
          result.details.push({
            dealId: deal.id,
            rowId: deal.rowId,
            fromStage: stage.name,
            toStage: nextStage.name,
            daysInactive,
          });
        } catch (error) {
          result.errors.push({
            dealId: deal.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in auto-move processing:", error);
  }

  return result;
}

/**
 * Process auto-move for all users
 */
export async function processAutoMoveForAllUsers(): Promise<{
  usersProcessed: number;
  totalMoved: number;
  results: Array<{ userId: string; result: AutoMoveResult }>;
}> {
  const results: Array<{ userId: string; result: AutoMoveResult }> = [];

  // Get all users with active pipelines
  const usersWithPipelines = await prisma.user.findMany({
    where: {
      projects: {
        some: {
          pipelines: {
            some: {
              stages: {
                some: {
                  autoMoveAfterDays: { not: null },
                },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  for (const user of usersWithPipelines) {
    const result = await processAutoMoveForUser(user.id);
    results.push({ userId: user.id, result });
  }

  return {
    usersProcessed: usersWithPipelines.length,
    totalMoved: results.reduce((sum, r) => sum + r.result.moved, 0),
    results,
  };
}
