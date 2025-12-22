import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface CRMStats {
  // Pipeline Overview
  pipeline: {
    totalDeals: number;
    totalValue: number;
    weightedValue: number;
    avgDealSize: number;
    dealsPerStage: Array<{
      stageId: string;
      stageName: string;
      stageColor: string;
      count: number;
      value: number;
    }>;
  };
  // Win/Loss Stats
  performance: {
    wonDeals: number;
    wonValue: number;
    lostDeals: number;
    lostValue: number;
    winRate: number;
    avgDaysToClose: number;
  };
  // Activity Stats
  activities: {
    totalThisWeek: number;
    callsThisWeek: number;
    emailsThisWeek: number;
    meetingsThisWeek: number;
    notesThisWeek: number;
    tasksOverdue: number;
    tasksDueToday: number;
  };
  // Trends (last 30 days, grouped by week)
  trends: {
    dealsCreated: Array<{ week: string; count: number }>;
    dealsWon: Array<{ week: string; count: number; value: number }>;
    activitiesLogged: Array<{ week: string; count: number }>;
  };
  // Forecasts
  forecast: {
    expectedCloseThisMonth: number;
    expectedCloseNextMonth: number;
    pipelineByMonth: Array<{
      month: string;
      count: number;
      value: number;
      weightedValue: number;
    }>;
  };
  // Recent Items
  recent: {
    deals: Array<{
      id: string;
      name: string;
      value: number;
      stageName: string;
      stageColor: string;
      updatedAt: string;
    }>;
    activities: Array<{
      id: string;
      type: string;
      title: string;
      contactName: string;
      createdAt: string;
    }>;
  };
  // Email Tracking Stats
  emailTracking: {
    totalSent: number;
    totalOpened: number;
    totalReplied: number;
    openRate: number;
    replyRate: number;
    sentThisWeek: number;
    openedThisWeek: number;
    repliedThisWeek: number;
    recentEmails: Array<{
      id: string;
      subject: string;
      toEmail: string;
      sentAt: string;
      openCount: number;
      isReplied: boolean;
      lastOpenedAt: string | null;
    }>;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    // Build project filter based on organization
    const projectFilter = organizationId
      ? { project: { organizationId } }
      : { project: { userId } };

    // Build activity filter based on organization
    const activityFilter = organizationId
      ? { row: { table: { project: { organizationId } } } }
      : { userId };

    // Get all user's pipelines with stages and deals
    const pipelines = await prisma.pipeline.findMany({
      where: projectFilter,
      include: {
        stages: {
          orderBy: { position: "asc" },
          include: {
            deals: {
              include: {
                row: {
                  select: {
                    cells: {
                      where: { column: { type: { in: ["COMPANY", "PERSON"] } } },
                      include: { column: { select: { type: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Flatten all deals
    const allDeals = pipelines.flatMap((p) =>
      p.stages.flatMap((s) =>
        s.deals.map((d) => ({
          ...d,
          stageName: s.name,
          stageColor: s.color,
          stageType: s.stageType,
        }))
      )
    );

    // Pipeline stats
    const openDeals = allDeals.filter((d) => !d.wonAt && !d.lostAt);
    const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const weightedValue = openDeals.reduce(
      (sum, d) => sum + (d.value || 0) * (d.probability / 100),
      0
    );
    const avgDealSize = openDeals.length > 0 ? totalValue / openDeals.length : 0;

    // Deals per stage
    const dealsPerStage = pipelines.flatMap((p) =>
      p.stages
        .filter((s) => s.stageType === "OPEN")
        .map((s) => ({
          stageId: s.id,
          stageName: s.name,
          stageColor: s.color,
          count: s.deals.filter((d) => !d.wonAt && !d.lostAt).length,
          value: s.deals
            .filter((d) => !d.wonAt && !d.lostAt)
            .reduce((sum, d) => sum + (d.value || 0), 0),
        }))
    );

    // Win/Loss stats
    const wonDeals = allDeals.filter((d) => d.wonAt);
    const lostDeals = allDeals.filter((d) => d.lostAt);
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const lostValue = lostDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;

    // Average days to close
    const closedWithDates = wonDeals.filter((d) => d.wonAt && d.createdAt);
    const avgDaysToClose =
      closedWithDates.length > 0
        ? closedWithDates.reduce((sum, d) => {
            const days = Math.floor(
              (new Date(d.wonAt!).getTime() - new Date(d.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / closedWithDates.length
        : 0;

    // Activity stats
    const [
      totalActivitiesThisWeek,
      callsThisWeek,
      emailsThisWeek,
      meetingsThisWeek,
      notesThisWeek,
      tasksOverdue,
      tasksDueToday,
    ] = await Promise.all([
      prisma.activity.count({
        where: { ...activityFilter, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.activity.count({
        where: { ...activityFilter, type: "CALL", createdAt: { gte: oneWeekAgo } },
      }),
      prisma.activity.count({
        where: { ...activityFilter, type: "EMAIL", createdAt: { gte: oneWeekAgo } },
      }),
      prisma.activity.count({
        where: { ...activityFilter, type: "MEETING", createdAt: { gte: oneWeekAgo } },
      }),
      prisma.activity.count({
        where: { ...activityFilter, type: "NOTE", createdAt: { gte: oneWeekAgo } },
      }),
      prisma.activity.count({
        where: {
          ...activityFilter,
          type: "TASK",
          status: { in: ["PLANNED"] },
          dueDate: { lt: startOfToday },
        },
      }),
      prisma.activity.count({
        where: {
          ...activityFilter,
          type: "TASK",
          status: { in: ["PLANNED"] },
          dueDate: { gte: startOfToday, lte: endOfToday },
        },
      }),
    ]);

    // Trends - Deals created per week (last 4 weeks)
    const dealsCreatedTrend = [];
    const dealsWonTrend = [];
    const activitiesTrend = [];

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const weekLabel = `KW ${getWeekNumber(weekStart)}`;

      // Deals created
      const dealsCreated = await prisma.deal.count({
        where: {
          stage: { pipeline: projectFilter },
          createdAt: { gte: weekStart, lt: weekEnd },
        },
      });
      dealsCreatedTrend.push({ week: weekLabel, count: dealsCreated });

      // Deals won
      const dealsWonData = await prisma.deal.findMany({
        where: {
          stage: { pipeline: projectFilter },
          wonAt: { gte: weekStart, lt: weekEnd },
        },
        select: { value: true },
      });
      dealsWonTrend.push({
        week: weekLabel,
        count: dealsWonData.length,
        value: dealsWonData.reduce((sum, d) => sum + (d.value || 0), 0),
      });

      // Activities
      const activitiesCount = await prisma.activity.count({
        where: { ...activityFilter, createdAt: { gte: weekStart, lt: weekEnd } },
      });
      activitiesTrend.push({ week: weekLabel, count: activitiesCount });
    }

    // Forecast - Expected close by month
    const expectedThisMonth = openDeals
      .filter(
        (d) =>
          d.expectedClose &&
          new Date(d.expectedClose) >= startOfMonth &&
          new Date(d.expectedClose) < startOfNextMonth
      )
      .reduce((sum, d) => sum + (d.value || 0) * (d.probability / 100), 0);

    const expectedNextMonth = openDeals
      .filter(
        (d) =>
          d.expectedClose &&
          new Date(d.expectedClose) >= startOfNextMonth &&
          new Date(d.expectedClose) <= endOfNextMonth
      )
      .reduce((sum, d) => sum + (d.value || 0) * (d.probability / 100), 0);

    // Pipeline by month (next 3 months)
    const pipelineByMonth = [];
    for (let i = 0; i < 3; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const monthLabel = monthStart.toLocaleString("de-DE", { month: "short", year: "2-digit" });

      const dealsInMonth = openDeals.filter(
        (d) =>
          d.expectedClose &&
          new Date(d.expectedClose) >= monthStart &&
          new Date(d.expectedClose) <= monthEnd
      );

      pipelineByMonth.push({
        month: monthLabel,
        count: dealsInMonth.length,
        value: dealsInMonth.reduce((sum, d) => sum + (d.value || 0), 0),
        weightedValue: dealsInMonth.reduce(
          (sum, d) => sum + (d.value || 0) * (d.probability / 100),
          0
        ),
      });
    }

    // Recent deals
    const recentDeals = openDeals
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((d) => {
        const companyCell = d.row?.cells?.find((c) => c.column.type === "COMPANY");
        const personCell = d.row?.cells?.find((c) => c.column.type === "PERSON");
        const name =
          (companyCell?.value as string) || (personCell?.value as string) || "Unbekannt";

        return {
          id: d.id,
          name,
          value: d.value || 0,
          stageName: d.stageName,
          stageColor: d.stageColor,
          updatedAt: d.updatedAt.toISOString(),
        };
      });

    // Recent activities
    const recentActivities = await prisma.activity.findMany({
      where: activityFilter,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        row: {
          select: {
            cells: {
              where: { column: { type: { in: ["COMPANY", "PERSON"] } } },
              include: { column: { select: { type: true } } },
            },
          },
        },
      },
    });

    const formattedRecentActivities = recentActivities.map((a) => {
      const companyCell = a.row?.cells?.find((c) => c.column.type === "COMPANY");
      const personCell = a.row?.cells?.find((c) => c.column.type === "PERSON");
      const contactName =
        (companyCell?.value as string) || (personCell?.value as string) || "Unbekannt";

      return {
        id: a.id,
        type: a.type,
        title: a.title,
        contactName,
        createdAt: a.createdAt.toISOString(),
      };
    });

    // Email Tracking Stats
    const userEmailAccounts = await prisma.emailAccount.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = userEmailAccounts.map((a) => a.id);

    const [
      totalSentEmails,
      totalOpenedEmails,
      totalRepliedEmails,
      sentThisWeekEmails,
      openedThisWeekEmails,
      repliedThisWeekEmails,
    ] = await Promise.all([
      prisma.emailMessage.count({
        where: { emailAccountId: { in: accountIds }, direction: "OUTBOUND", status: "SENT" },
      }),
      prisma.emailMessage.count({
        where: { emailAccountId: { in: accountIds }, direction: "OUTBOUND", status: "SENT", openCount: { gt: 0 } },
      }),
      prisma.emailMessage.count({
        where: { emailAccountId: { in: accountIds }, direction: "OUTBOUND", status: "SENT", isReplied: true },
      }),
      prisma.emailMessage.count({
        where: {
          emailAccountId: { in: accountIds },
          direction: "OUTBOUND",
          status: "SENT",
          sentAt: { gte: oneWeekAgo },
        },
      }),
      prisma.emailMessage.count({
        where: {
          emailAccountId: { in: accountIds },
          direction: "OUTBOUND",
          status: "SENT",
          lastOpenedAt: { gte: oneWeekAgo },
        },
      }),
      prisma.emailMessage.count({
        where: {
          emailAccountId: { in: accountIds },
          direction: "OUTBOUND",
          status: "SENT",
          repliedAt: { gte: oneWeekAgo },
        },
      }),
    ]);

    const openRate = totalSentEmails > 0 ? (totalOpenedEmails / totalSentEmails) * 100 : 0;
    const replyRate = totalSentEmails > 0 ? (totalRepliedEmails / totalSentEmails) * 100 : 0;

    // Recent emails with tracking info
    const recentEmailsData = await prisma.emailMessage.findMany({
      where: { emailAccountId: { in: accountIds }, direction: "OUTBOUND", status: "SENT" },
      orderBy: { sentAt: "desc" },
      take: 10,
      select: {
        id: true,
        subject: true,
        toEmail: true,
        sentAt: true,
        openCount: true,
        isReplied: true,
        lastOpenedAt: true,
      },
    });

    const recentEmails = recentEmailsData.map((e) => ({
      id: e.id,
      subject: e.subject,
      toEmail: e.toEmail,
      sentAt: e.sentAt?.toISOString() || "",
      openCount: e.openCount,
      isReplied: e.isReplied,
      lastOpenedAt: e.lastOpenedAt?.toISOString() || null,
    }));

    const stats: CRMStats = {
      pipeline: {
        totalDeals: openDeals.length,
        totalValue,
        weightedValue,
        avgDealSize,
        dealsPerStage,
      },
      performance: {
        wonDeals: wonDeals.length,
        wonValue,
        lostDeals: lostDeals.length,
        lostValue,
        winRate,
        avgDaysToClose,
      },
      activities: {
        totalThisWeek: totalActivitiesThisWeek,
        callsThisWeek,
        emailsThisWeek,
        meetingsThisWeek,
        notesThisWeek,
        tasksOverdue,
        tasksDueToday,
      },
      trends: {
        dealsCreated: dealsCreatedTrend,
        dealsWon: dealsWonTrend,
        activitiesLogged: activitiesTrend,
      },
      forecast: {
        expectedCloseThisMonth: expectedThisMonth,
        expectedCloseNextMonth: expectedNextMonth,
        pipelineByMonth,
      },
      recent: {
        deals: recentDeals,
        activities: formattedRecentActivities,
      },
      emailTracking: {
        totalSent: totalSentEmails,
        totalOpened: totalOpenedEmails,
        totalReplied: totalRepliedEmails,
        openRate,
        replyRate,
        sentThisWeek: sentThisWeekEmails,
        openedThisWeek: openedThisWeekEmails,
        repliedThisWeek: repliedThisWeekEmails,
        recentEmails,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dashboard CRM stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CRM stats" },
      { status: 500 }
    );
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
