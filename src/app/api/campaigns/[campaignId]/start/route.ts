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
        sequences: true,
        recipients: {
          where: { status: "PENDING" },
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

    // Nur OWNER, ADMIN und MANAGER dürfen Kampagnen starten
    if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Starten" },
        { status: 403 }
      );
    }

    // Prüfen ob Kampagne gestartet werden kann
    if (campaign.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Kampagne läuft bereits" },
        { status: 400 }
      );
    }

    if (campaign.status === "COMPLETED" || campaign.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Abgeschlossene Kampagnen können nicht neu gestartet werden" },
        { status: 400 }
      );
    }

    // Validierungen
    if (campaign.sequences.length === 0) {
      return NextResponse.json(
        { error: "Kampagne hat keine E-Mail-Sequenzen. Bitte mindestens eine Sequenz hinzufügen." },
        { status: 400 }
      );
    }

    if (campaign.recipients.length === 0) {
      return NextResponse.json(
        { error: "Kampagne hat keine Empfänger. Bitte Empfänger hinzufügen." },
        { status: 400 }
      );
    }

    if (campaign.accountIds.length === 0) {
      return NextResponse.json(
        { error: "Kampagne hat keine E-Mail-Konten zugewiesen. Bitte mindestens ein Konto auswählen." },
        { status: 400 }
      );
    }

    // Prüfen ob E-Mail-Konten gültig und aktiv sind
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

    // Kampagne starten
    const now = new Date();
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "ACTIVE",
        scheduleStartAt: campaign.scheduleStartAt || now,
      },
    });

    // Erste Empfänger für den Versand vorbereiten
    // nextSendAt setzen für alle PENDING Empfänger
    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: "PENDING",
        nextSendAt: null,
      },
      data: {
        nextSendAt: now,
        startedAt: now,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kampagne wurde gestartet",
      campaign: updatedCampaign,
      activeAccounts: accounts.length,
      pendingRecipients: campaign.recipients.length,
    });
  } catch (error) {
    console.error("Error starting campaign:", error);
    return NextResponse.json(
      { error: "Failed to start campaign" },
      { status: 500 }
    );
  }
}
