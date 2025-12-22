import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
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
        recipients: {
          where: { status: "PAUSED" },
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

    // Nur OWNER, ADMIN und MANAGER dürfen Kampagnen fortsetzen
    if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Fortsetzen" },
        { status: 403 }
      );
    }

    // Prüfen ob Kampagne fortgesetzt werden kann
    if (campaign.status !== "PAUSED") {
      return NextResponse.json(
        { error: "Nur pausierte Kampagnen können fortgesetzt werden" },
        { status: 400 }
      );
    }

    // Prüfen ob E-Mail-Konten noch gültig und aktiv sind
    const accounts = await prisma.emailAccount.findMany({
      where: {
        id: { in: campaign.accountIds },
        isActive: true,
        isBlocked: false,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "Keine aktiven E-Mail-Konten verfügbar. Bitte Konten überprüfen." },
        { status: 400 }
      );
    }

    // Kampagne fortsetzen
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "ACTIVE",
      },
    });

    // Pausierte Empfänger wieder aktivieren
    const now = new Date();
    const resumedRecipients = await prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: "PAUSED",
      },
      data: {
        status: "ACTIVE",
        nextSendAt: now, // Sofort wieder in die Queue
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kampagne wurde fortgesetzt",
      campaign: updatedCampaign,
      resumedRecipients: resumedRecipients.count,
      activeAccounts: accounts.length,
    });
  } catch (error) {
    console.error("Error resuming campaign:", error);
    return NextResponse.json(
      { error: "Failed to resume campaign" },
      { status: 500 }
    );
  }
}
