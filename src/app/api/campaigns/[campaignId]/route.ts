import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  dailyLimit: z.number().min(1).max(1000).optional(),
  sendingDays: z.array(z.string()).optional(),
  sendingHoursStart: z.number().min(0).max(23).optional(),
  sendingHoursEnd: z.number().min(0).max(23).optional(),
  timezone: z.string().optional(),
  scheduleStartAt: z.string().datetime().optional().nullable(),
  scheduleEndAt: z.string().datetime().optional().nullable(),
  stopOnReply: z.boolean().optional(),
  stopOnBounce: z.boolean().optional(),
  trackOpens: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        sequences: {
          orderBy: { stepNumber: "asc" },
          include: {
            variants: true,
            _count: {
              select: { sentEmails: true },
            },
          },
        },
        _count: {
          select: {
            sequences: true,
            recipients: true,
            sentEmails: true,
          },
        },
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Nur OWNER, ADMIN und MANAGER dürfen Kampagnen bearbeiten
    if (!["OWNER", "ADMIN", "MANAGER"].includes(access.membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Bearbeiten" },
        { status: 403 }
      );
    }

    // Aktive Kampagnen können nicht bearbeitet werden
    if (access.campaign.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Aktive Kampagnen können nicht bearbeitet werden. Bitte zuerst pausieren." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateCampaignSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.accountIds !== undefined) updateData.accountIds = validatedData.accountIds;
    if (validatedData.dailyLimit !== undefined) updateData.dailyLimit = validatedData.dailyLimit;
    if (validatedData.sendingDays !== undefined) updateData.sendingDays = validatedData.sendingDays;
    if (validatedData.sendingHoursStart !== undefined) updateData.sendingHoursStart = validatedData.sendingHoursStart;
    if (validatedData.sendingHoursEnd !== undefined) updateData.sendingHoursEnd = validatedData.sendingHoursEnd;
    if (validatedData.timezone !== undefined) updateData.timezone = validatedData.timezone;
    if (validatedData.scheduleStartAt !== undefined) {
      updateData.scheduleStartAt = validatedData.scheduleStartAt ? new Date(validatedData.scheduleStartAt) : null;
    }
    if (validatedData.scheduleEndAt !== undefined) {
      updateData.scheduleEndAt = validatedData.scheduleEndAt ? new Date(validatedData.scheduleEndAt) : null;
    }
    if (validatedData.stopOnReply !== undefined) updateData.stopOnReply = validatedData.stopOnReply;
    if (validatedData.stopOnBounce !== undefined) updateData.stopOnBounce = validatedData.stopOnBounce;
    if (validatedData.trackOpens !== undefined) updateData.trackOpens = validatedData.trackOpens;
    if (validatedData.trackClicks !== undefined) updateData.trackClicks = validatedData.trackClicks;

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            sequences: true,
            recipients: true,
          },
        },
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error updating campaign:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Nur OWNER und ADMIN dürfen Kampagnen löschen
    if (!["OWNER", "ADMIN"].includes(access.membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Löschen" },
        { status: 403 }
      );
    }

    // Aktive Kampagnen können nicht gelöscht werden
    if (access.campaign.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Aktive Kampagnen können nicht gelöscht werden. Bitte zuerst stoppen." },
        { status: 400 }
      );
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
