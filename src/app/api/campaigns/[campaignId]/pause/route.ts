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

    // Nur OWNER, ADMIN und MANAGER dürfen Kampagnen pausieren
    if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Pausieren" },
        { status: 403 }
      );
    }

    // Prüfen ob Kampagne pausiert werden kann
    if (campaign.status !== "ACTIVE" && campaign.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "Nur aktive oder geplante Kampagnen können pausiert werden" },
        { status: 400 }
      );
    }

    // Kampagne pausieren
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "PAUSED",
      },
    });

    // Aktive Empfänger pausieren
    const pausedRecipients = await prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: "ACTIVE",
      },
      data: {
        status: "PAUSED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kampagne wurde pausiert",
      campaign: updatedCampaign,
      pausedRecipients: pausedRecipients.count,
    });
  } catch (error) {
    console.error("Error pausing campaign:", error);
    return NextResponse.json(
      { error: "Failed to pause campaign" },
      { status: 500 }
    );
  }
}
