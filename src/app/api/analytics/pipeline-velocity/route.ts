import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface PipelineVelocityStats {
  // Overall velocity metrics
  avgDaysToClose: number;
  avgDaysInPipeline: number;
  dealsClosedInPeriod: number;
  totalValueClosed: number;

  // Stage-by-stage metrics
  stageMetrics: Array<{
    stageId: string;
    stageName: string;
    stageColor: string;
    avgDaysInStage: number;
    dealsCurrently: number;
    dealsPassedThrough: number;
    conversionRate: number; // % that moved to next stage
  }>;

  // Velocity trends (by week)
  velocityTrend: Array<{
    week: string;
    avgDaysToClose: number;
    dealsWon: number;
    valueWon: number;
  }>;

  // Bottleneck analysis
  bottlenecks: Array<{
    stageId: string;
    stageName: string;
    avgDays: number;
    stuckDeals: number; // Deals in stage > average
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const organizationId = searchParams.get("organizationId");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's projects (filtered by org if provided)
    const projects = await prisma.project.findMany({
      where: {
        ...(organizationId
          ? { organizationId }
          : { userId: session.user.id }),
      },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json(getEmptyStats());
    }

    // Get all pipelines for these projects
    const pipelines = await prisma.pipeline.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        stages: {
          orderBy: { position: "asc" },
          include: {
            deals: {
              include: {
                row: true,
              },
            },
          },
        },
      },
    });

    // Get won deals in period for velocity calculation
    const wonDeals = await prisma.deal.findMany({
      where: {
        stage: {
          pipeline: {
            projectId: { in: projectIds },
          },
          stageType: "WON",
        },
        wonAt: {
          gte: startDate,
        },
      },
      include: {
        stage: true,
        row: true,
      },
    });

    // Calculate average days to close for won deals
    let totalDaysToClose = 0;
    let totalValueClosed = 0;
    wonDeals.forEach((deal) => {
      if (deal.wonAt && deal.createdAt) {
        const daysToClose = Math.ceil(
          (deal.wonAt.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDaysToClose += daysToClose;
      }
      totalValueClosed += deal.value || 0;
    });

    const avgDaysToClose = wonDeals.length > 0
      ? Math.round(totalDaysToClose / wonDeals.length)
      : 0;

    // Calculate stage metrics
    const stageMetrics: PipelineVelocityStats["stageMetrics"] = [];
    const bottlenecks: PipelineVelocityStats["bottlenecks"] = [];

    for (const pipeline of pipelines) {
      for (let i = 0; i < pipeline.stages.length; i++) {
        const stage = pipeline.stages[i];
        const nextStage = pipeline.stages[i + 1];

        // Calculate avg days in this stage
        let totalDaysInStage = 0;
        let dealsWithTime = 0;
        const now = new Date();

        stage.deals.forEach((deal) => {
          const daysInStage = Math.ceil(
            (now.getTime() - deal.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          totalDaysInStage += daysInStage;
          dealsWithTime++;
        });

        const avgDaysInStage = dealsWithTime > 0
          ? Math.round(totalDaysInStage / dealsWithTime)
          : 0;

        // Calculate conversion rate (deals that moved to next stage)
        // This is simplified - in production you'd track stage history
        const dealsInStage = stage.deals.length;
        const dealsInNextStage = nextStage?.deals.length || 0;
        const conversionRate = dealsInStage > 0
          ? Math.round((dealsInNextStage / dealsInStage) * 100)
          : 0;

        stageMetrics.push({
          stageId: stage.id,
          stageName: stage.name,
          stageColor: stage.color,
          avgDaysInStage,
          dealsCurrently: dealsInStage,
          dealsPassedThrough: dealsInStage + dealsInNextStage,
          conversionRate: Math.min(conversionRate, 100),
        });

        // Identify bottlenecks (stages with high avg days and stuck deals)
        if (avgDaysInStage > 7 && dealsInStage > 0) {
          const stuckDeals = stage.deals.filter((deal) => {
            const daysInStage = Math.ceil(
              (now.getTime() - deal.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysInStage > avgDaysInStage;
          }).length;

          if (stuckDeals > 0) {
            bottlenecks.push({
              stageId: stage.id,
              stageName: stage.name,
              avgDays: avgDaysInStage,
              stuckDeals,
            });
          }
        }
      }
    }

    // Calculate velocity trend by week
    const velocityTrend: PipelineVelocityStats["velocityTrend"] = [];
    const weeksInPeriod = Math.ceil(days / 7);

    for (let w = 0; w < Math.min(weeksInPeriod, 4); w++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - w * 7);

      const weekDeals = wonDeals.filter(
        (d) => d.wonAt && d.wonAt >= weekStart && d.wonAt < weekEnd
      );

      let weekDaysTotal = 0;
      let weekValue = 0;
      weekDeals.forEach((deal) => {
        if (deal.wonAt && deal.createdAt) {
          weekDaysTotal += Math.ceil(
            (deal.wonAt.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
        }
        weekValue += deal.value || 0;
      });

      velocityTrend.unshift({
        week: `KW ${getWeekNumber(weekEnd)}`,
        avgDaysToClose: weekDeals.length > 0
          ? Math.round(weekDaysTotal / weekDeals.length)
          : 0,
        dealsWon: weekDeals.length,
        valueWon: weekValue,
      });
    }

    // Calculate overall avg days in pipeline for open deals
    let totalDaysInPipeline = 0;
    let openDealsCount = 0;
    const now = new Date();

    pipelines.forEach((pipeline) => {
      pipeline.stages.forEach((stage) => {
        if (stage.stageType === "OPEN") {
          stage.deals.forEach((deal) => {
            const daysInPipeline = Math.ceil(
              (now.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            totalDaysInPipeline += daysInPipeline;
            openDealsCount++;
          });
        }
      });
    });

    const avgDaysInPipeline = openDealsCount > 0
      ? Math.round(totalDaysInPipeline / openDealsCount)
      : 0;

    const stats: PipelineVelocityStats = {
      avgDaysToClose,
      avgDaysInPipeline,
      dealsClosedInPeriod: wonDeals.length,
      totalValueClosed,
      stageMetrics,
      velocityTrend,
      bottlenecks: bottlenecks.sort((a, b) => b.avgDays - a.avgDays).slice(0, 5),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Pipeline velocity stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline velocity stats" },
      { status: 500 }
    );
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getEmptyStats(): PipelineVelocityStats {
  return {
    avgDaysToClose: 0,
    avgDaysInPipeline: 0,
    dealsClosedInPeriod: 0,
    totalValueClosed: 0,
    stageMetrics: [],
    velocityTrend: [],
    bottlenecks: [],
  };
}
