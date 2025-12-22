import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const addRecipientSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional().default({}),
  rowId: z.string().optional(),
});

const addRecipientsSchema = z.object({
  recipients: z.array(addRecipientSchema),
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
    const { searchParams } = new URL(request.url);

    const access = await checkCampaignAccess(campaignId, session.user.id);

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    // Filter
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const whereClause: Record<string, unknown> = { campaignId };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    const [recipients, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { sentEmails: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.campaignRecipient.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      recipients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching recipients:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
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

    // Nur OWNER, ADMIN und MANAGER dürfen Empfänger hinzufügen
    if (!["OWNER", "ADMIN", "MANAGER"].includes(access.membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Einzelner Empfänger oder mehrere?
    if (body.recipients) {
      // Mehrere Empfänger
      const validatedData = addRecipientsSchema.parse(body);

      // Bereits existierende E-Mails filtern
      const existingEmails = await prisma.campaignRecipient.findMany({
        where: {
          campaignId,
          email: { in: validatedData.recipients.map(r => r.email.toLowerCase()) },
        },
        select: { email: true },
      });

      const existingEmailSet = new Set(existingEmails.map(e => e.email.toLowerCase()));
      const newRecipients = validatedData.recipients.filter(
        r => !existingEmailSet.has(r.email.toLowerCase())
      );

      if (newRecipients.length === 0) {
        return NextResponse.json({
          success: true,
          added: 0,
          skipped: validatedData.recipients.length,
          message: "Alle E-Mail-Adressen existieren bereits in dieser Kampagne",
        });
      }

      // Empfänger erstellen
      await prisma.campaignRecipient.createMany({
        data: newRecipients.map(r => ({
          campaignId,
          email: r.email.toLowerCase(),
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
          variables: r.variables || {},
          rowId: r.rowId,
        })),
      });

      // Recipient count aktualisieren
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          recipientCount: {
            increment: newRecipients.length,
          },
        },
      });

      return NextResponse.json({
        success: true,
        added: newRecipients.length,
        skipped: validatedData.recipients.length - newRecipients.length,
      });
    } else {
      // Einzelner Empfänger
      const validatedData = addRecipientSchema.parse(body);

      // Prüfen ob Email bereits existiert
      const existing = await prisma.campaignRecipient.findUnique({
        where: {
          campaignId_email: {
            campaignId,
            email: validatedData.email.toLowerCase(),
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Diese E-Mail-Adresse existiert bereits in dieser Kampagne" },
          { status: 400 }
        );
      }

      const recipient = await prisma.campaignRecipient.create({
        data: {
          campaignId,
          email: validatedData.email.toLowerCase(),
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          company: validatedData.company,
          variables: validatedData.variables,
          rowId: validatedData.rowId,
        },
      });

      // Recipient count aktualisieren
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          recipientCount: { increment: 1 },
        },
      });

      return NextResponse.json(recipient, { status: 201 });
    }
  } catch (error) {
    console.error("Error adding recipients:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to add recipients" },
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
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";

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

    // Aktive Kampagnen: nur PENDING Empfänger löschen
    if (access.campaign.status === "ACTIVE" && !deleteAll) {
      return NextResponse.json(
        { error: "Bei aktiven Kampagnen können keine einzelnen Empfänger gelöscht werden" },
        { status: 400 }
      );
    }

    if (deleteAll) {
      // Alle PENDING Empfänger löschen
      const deleted = await prisma.campaignRecipient.deleteMany({
        where: {
          campaignId,
          status: "PENDING",
        },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          recipientCount: { decrement: deleted.count },
        },
      });

      return NextResponse.json({
        success: true,
        deleted: deleted.count,
      });
    } else if (recipientId) {
      // Einzelnen Empfänger löschen
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId, campaignId },
      });

      if (!recipient) {
        return NextResponse.json(
          { error: "Empfänger nicht gefunden" },
          { status: 404 }
        );
      }

      if (recipient.status !== "PENDING") {
        return NextResponse.json(
          { error: "Nur wartende Empfänger können gelöscht werden" },
          { status: 400 }
        );
      }

      await prisma.campaignRecipient.delete({
        where: { id: recipientId },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          recipientCount: { decrement: 1 },
        },
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Keine Empfänger-ID oder 'all' Parameter angegeben" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error deleting recipients:", error);
    return NextResponse.json(
      { error: "Failed to delete recipients" },
      { status: 500 }
    );
  }
}
