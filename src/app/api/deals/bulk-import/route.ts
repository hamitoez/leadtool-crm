import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { onDealCreated } from "@/lib/workflow/trigger";
import { calculateLeadScore } from "@/lib/pipeline/scoring";

const bulkImportSchema = z.object({
  pipelineId: z.string(),
  stageId: z.string(),
  // Optional: specific row IDs, otherwise all rows without deals
  rowIds: z.array(z.string()).optional(),
  // Auto-scoring options
  applyScoring: z.boolean().default(true),
  // Default probability if no scoring
  defaultProbability: z.number().min(0).max(100).default(50),
});

// POST /api/deals/bulk-import - Import multiple rows as deals
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = bulkImportSchema.parse(body);

    // Verify pipeline and stage access
    const stage = await prisma.pipelineStage.findFirst({
      where: {
        id: data.stageId,
        pipelineId: data.pipelineId,
        pipeline: { project: { userId: session.user.id } },
      },
      include: {
        pipeline: {
          include: {
            project: { select: { id: true } },
          },
        },
      },
    });

    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    // Get rows to import
    let rowsQuery: Parameters<typeof prisma.row.findMany>[0] = {
      where: {
        table: {
          projectId: stage.pipeline.project.id,
          project: { userId: session.user.id },
        },
        // Exclude rows that already have deals
        deal: null,
      },
      include: {
        cells: { include: { column: true } },
        table: { select: { id: true, name: true } },
      },
    };

    // If specific rowIds provided, filter to those
    if (data.rowIds && data.rowIds.length > 0) {
      rowsQuery.where = {
        ...rowsQuery.where,
        id: { in: data.rowIds },
      };
    }

    type RowWithCells = {
      id: string;
      cells: Array<{
        value: unknown;
        column: {
          type: string;
          name: string;
        };
      }>;
    };
    const rows = (await prisma.row.findMany(rowsQuery)) as unknown as RowWithCells[];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Keine Leads ohne Deal gefunden",
        created: 0,
        failed: 0,
        deals: [],
      });
    }

    // Get current max position in stage
    const maxDeal = await prisma.deal.findFirst({
      where: { stageId: data.stageId },
      orderBy: { position: "desc" },
    });
    let nextPosition = (maxDeal?.position ?? -1) + 1;

    // Create deals in batch
    const results = {
      created: 0,
      failed: 0,
      errors: [] as Array<{ rowId: string; error: string }>,
      deals: [] as Array<{ id: string; rowId: string; score: number }>,
    };

    for (const row of rows) {
      try {
        // Calculate score if enabled
        let probability = data.defaultProbability;
        let score = 50;

        if (data.applyScoring) {
          const scoring = calculateLeadScore(row);
          score = scoring.totalScore;
          probability = Math.min(Math.max(scoring.totalScore, 10), 90);
        }

        // Create deal
        const deal = await prisma.deal.create({
          data: {
            rowId: row.id,
            stageId: data.stageId,
            probability,
            position: nextPosition++,
          },
        });

        // Create history entry
        await prisma.contactHistory.create({
          data: {
            rowId: row.id,
            userId: session.user.id,
            eventType: "DEAL_CREATED",
            title: "Deal automatisch erstellt",
            description: `Lead wurde automatisch zur Pipeline hinzugefügt (Score: ${score})`,
            metadata: {
              stageId: data.stageId,
              stageName: stage.name,
              score,
              isAutomatic: true,
            },
          },
        });

        // Trigger workflow (fire and forget)
        onDealCreated(
          session.user.id,
          deal.id,
          row.id,
          data.pipelineId,
          data.stageId
        );

        results.created++;
        results.deals.push({ id: deal.id, rowId: row.id, score });
      } catch (error) {
        results.failed++;
        results.errors.push({
          rowId: row.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.created} Deals erstellt, ${results.failed} fehlgeschlagen`,
      ...results,
    });
  } catch (error) {
    console.error("Error in bulk import:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to import deals" },
      { status: 500 }
    );
  }
}
