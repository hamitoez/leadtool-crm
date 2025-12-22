import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { campaignId } = await params;

    // Kampagne mit Zugriffsrechten laden
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId: session.user.id, isActive: true },
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Kampagne nicht gefunden" },
        { status: 404 }
      );
    }

    const membership = campaign.organization.members[0];
    if (!membership) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Statistiken berechnen
    const [
      recipientStats,
      emailStats,
      sequenceStats,
    ] = await Promise.all([
      // Empfänger-Status Verteilung
      prisma.campaignRecipient.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
      }),

      // E-Mail-Status Verteilung
      prisma.campaignSentEmail.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
      }),

      // Pro Sequence Stats
      prisma.campaignSequence.findMany({
        where: { campaignId },
        include: {
          _count: {
            select: { sentEmails: true },
          },
        },
        orderBy: { stepNumber: "asc" },
      }),
    ]);

    // Aggregierte Stats
    const sentEmails = await prisma.campaignSentEmail.findMany({
      where: { campaignId },
      select: {
        openCount: true,
        clickCount: true,
        openedAt: true,
        clickedAt: true,
        repliedAt: true,
        bouncedAt: true,
      },
    });

    const totalSent = sentEmails.length;
    const totalOpened = sentEmails.filter(e => e.openedAt).length;
    const totalClicked = sentEmails.filter(e => e.clickedAt).length;
    const totalReplied = sentEmails.filter(e => e.repliedAt).length;
    const totalBounced = sentEmails.filter(e => e.bouncedAt).length;

    // Tägliche Stats (letzte 30 Tage)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await prisma.campaignSentEmail.groupBy({
      by: ["sentAt"],
      where: {
        campaignId,
        sentAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    // Gruppieren nach Tag
    const dailyMap = new Map<string, number>();
    dailyStats.forEach(stat => {
      const day = stat.sentAt.toISOString().split("T")[0];
      dailyMap.set(day, (dailyMap.get(day) || 0) + stat._count);
    });

    const dailyData = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      totals: {
        recipients: recipientStats.reduce((sum, s) => sum + s._count, 0),
        sent: totalSent,
        opened: totalOpened,
        clicked: totalClicked,
        replied: totalReplied,
        bounced: totalBounced,
      },
      rates: {
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        replyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
        bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      },
      recipientsByStatus: recipientStats.map(s => ({
        status: s.status,
        count: s._count,
      })),
      emailsByStatus: emailStats.map(s => ({
        status: s.status,
        count: s._count,
      })),
      sequenceStats: sequenceStats.map(s => ({
        stepNumber: s.stepNumber,
        subject: s.subject,
        sent: s._count.sentEmails,
      })),
      dailyStats: dailyData,
    });
  } catch (error) {
    console.error("Error fetching campaign stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign stats" },
      { status: 500 }
    );
  }
}
