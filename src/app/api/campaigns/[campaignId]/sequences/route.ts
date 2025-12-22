import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createSequenceSchema = z.object({
  subject: z.string().min(1, "Betreff ist erforderlich"),
  body: z.string().min(1, "Inhalt ist erforderlich"),
  delayDays: z.number().min(0).default(1),
  delayHours: z.number().min(0).max(23).default(0),
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
    const access = await checkCampaignAccess(campaignId, session.user.id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const sequences = await prisma.campaignSequence.findMany({
      where: { campaignId },
      include: {
        variants: true,
        _count: {
          select: { sentEmails: true },
        },
      },
      orderBy: { stepNumber: "asc" },
    });

    return NextResponse.json(sequences);
  } catch (error) {
    console.error("Error fetching sequences:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequences" },
      { status: 500 }
    );
  }
}

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
    const access = await checkCampaignAccess(campaignId, session.user.id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    // Nur OWNER, ADMIN und MANAGER dürfen Sequenzen erstellen
    if (!["OWNER", "ADMIN", "MANAGER"].includes(access.membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Erstellen" },
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
    const validatedData = createSequenceSchema.parse(body);

    // Nächste Step-Nummer ermitteln
    const lastSequence = await prisma.campaignSequence.findFirst({
      where: { campaignId },
      orderBy: { stepNumber: "desc" },
    });

    const stepNumber = (lastSequence?.stepNumber || 0) + 1;

    const sequence = await prisma.campaignSequence.create({
      data: {
        campaignId,
        stepNumber,
        subject: validatedData.subject,
        body: validatedData.body,
        delayDays: validatedData.delayDays,
        delayHours: validatedData.delayHours,
      },
      include: {
        variants: true,
        _count: {
          select: { sentEmails: true },
        },
      },
    });

    return NextResponse.json(sequence, { status: 201 });
  } catch (error) {
    console.error("Error creating sequence:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create sequence" },
      { status: 500 }
    );
  }
}
