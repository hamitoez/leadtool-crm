import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateSequenceSchema = z.object({
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  delayDays: z.number().min(0).optional(),
  delayHours: z.number().min(0).max(23).optional(),
  stepNumber: z.number().min(1).optional(),
});

async function checkCampaignAccess(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      organization: {
        include: {
          members: {
            where: { userId, isActive: true },
          },
        },
      },
    },
  });

  if (!campaign) {
    return { error: "Kampagne nicht gefunden", status: 404 };
  }

  const membership = campaign.organization.members[0];
  if (!membership) {
    return { error: "Keine Berechtigung", status: 403 };
  }

  return { campaign, membership };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; sequenceId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { campaignId, sequenceId } = await params;
    const access = await checkCampaignAccess(campaignId, session.user.id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const sequence = await prisma.campaignSequence.findUnique({
      where: { id: sequenceId, campaignId },
      include: {
        variants: true,
        _count: {
          select: { sentEmails: true },
        },
      },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Sequenz nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("Error fetching sequence:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequence" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; sequenceId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { campaignId, sequenceId } = await params;
    const access = await checkCampaignAccess(campaignId, session.user.id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    // Nur OWNER, ADMIN und MANAGER dürfen bearbeiten
    if (!["OWNER", "ADMIN", "MANAGER"].includes(access.membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Bearbeiten" },
        { status: 403 }
      );
    }

    // Aktive Kampagnen können nicht bearbeitet werden
    if (access.campaign.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Aktive Kampagnen können nicht bearbeitet werden" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateSequenceSchema.parse(body);

    // Prüfen ob Sequenz existiert
    const existingSequence = await prisma.campaignSequence.findUnique({
      where: { id: sequenceId, campaignId },
    });

    if (!existingSequence) {
      return NextResponse.json(
        { error: "Sequenz nicht gefunden" },
        { status: 404 }
      );
    }

    // Wenn stepNumber geändert wird, andere Sequenzen verschieben
    if (validatedData.stepNumber && validatedData.stepNumber !== existingSequence.stepNumber) {
      const oldStep = existingSequence.stepNumber;
      const newStep = validatedData.stepNumber;

      if (newStep > oldStep) {
        // Nach unten verschieben: alle dazwischen eins hoch
        await prisma.campaignSequence.updateMany({
          where: {
            campaignId,
            stepNumber: { gt: oldStep, lte: newStep },
          },
          data: {
            stepNumber: { decrement: 1 },
          },
        });
      } else {
        // Nach oben verschieben: alle dazwischen eins runter
        await prisma.campaignSequence.updateMany({
          where: {
            campaignId,
            stepNumber: { gte: newStep, lt: oldStep },
          },
          data: {
            stepNumber: { increment: 1 },
          },
        });
      }
    }

    const sequence = await prisma.campaignSequence.update({
      where: { id: sequenceId },
      data: {
        subject: validatedData.subject,
        body: validatedData.body,
        delayDays: validatedData.delayDays,
        delayHours: validatedData.delayHours,
        stepNumber: validatedData.stepNumber,
      },
      include: {
        variants: true,
        _count: {
          select: { sentEmails: true },
        },
      },
    });

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("Error updating sequence:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update sequence" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; sequenceId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { campaignId, sequenceId } = await params;
    const access = await checkCampaignAccess(campaignId, session.user.id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    // Nur OWNER und ADMIN dürfen löschen
    if (!["OWNER", "ADMIN"].includes(access.membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Löschen" },
        { status: 403 }
      );
    }

    // Aktive Kampagnen können nicht bearbeitet werden
    if (access.campaign.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Aktive Kampagnen können nicht bearbeitet werden" },
        { status: 400 }
      );
    }

    // Prüfen ob Sequenz existiert
    const sequence = await prisma.campaignSequence.findUnique({
      where: { id: sequenceId, campaignId },
    });

    if (!sequence) {
      return NextResponse.json(
        { error: "Sequenz nicht gefunden" },
        { status: 404 }
      );
    }

    // Löschen
    await prisma.campaignSequence.delete({
      where: { id: sequenceId },
    });

    // Step-Nummern neu vergeben
    await prisma.$executeRaw`
      UPDATE campaign_sequences
      SET "stepNumber" = sub.new_step
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "stepNumber") as new_step
        FROM campaign_sequences
        WHERE "campaignId" = ${campaignId}
      ) sub
      WHERE campaign_sequences.id = sub.id
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sequence:", error);
    return NextResponse.json(
      { error: "Failed to delete sequence" },
      { status: 500 }
    );
  }
}
