import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createCampaignSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  organizationId: z.string().min(1, "Organisation ist erforderlich"),
  accountIds: z.array(z.string()).optional().default([]),
  dailyLimit: z.number().min(1).max(1000).optional().default(100),
  sendingDays: z.array(z.string()).optional().default(["MON", "TUE", "WED", "THU", "FRI"]),
  sendingHoursStart: z.number().min(0).max(23).optional().default(9),
  sendingHoursEnd: z.number().min(0).max(23).optional().default(17),
  timezone: z.string().optional().default("Europe/Berlin"),
  stopOnReply: z.boolean().optional().default(true),
  stopOnBounce: z.boolean().optional().default(true),
  trackOpens: z.boolean().optional().default(true),
  trackClicks: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const status = searchParams.get("status");

    // Finde Organisationen, in denen der User Mitglied ist
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    // Base where clause: nur Kampagnen aus zugänglichen Organisationen
    const whereClause: Record<string, unknown> = {
      organizationId: organizationId
        ? organizationId
        : { in: userOrgIds },
    };

    // Status filter
    if (status) {
      whereClause.status = status;
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
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
            sentEmails: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createCampaignSchema.parse(body);

    // Prüfen ob User Mitglied der Organisation ist
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: validatedData.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: "Keine Berechtigung für diese Organisation" },
        { status: 403 }
      );
    }

    // Nur OWNER, ADMIN und MANAGER dürfen Kampagnen erstellen
    if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Erstellen von Kampagnen" },
        { status: 403 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        organizationId: validatedData.organizationId,
        userId: session.user.id,
        accountIds: validatedData.accountIds,
        dailyLimit: validatedData.dailyLimit,
        sendingDays: validatedData.sendingDays,
        sendingHoursStart: validatedData.sendingHoursStart,
        sendingHoursEnd: validatedData.sendingHoursEnd,
        timezone: validatedData.timezone,
        stopOnReply: validatedData.stopOnReply,
        stopOnBounce: validatedData.stopOnBounce,
        trackOpens: validatedData.trackOpens,
        trackClicks: validatedData.trackClicks,
      },
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

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
