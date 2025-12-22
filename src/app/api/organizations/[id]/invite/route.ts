import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { OrganizationRole } from "@prisma/client";
import { sendInviteEmail } from "@/lib/email";

// Hilfsfunktion: Prüft ob User Mitglied ist und gibt Rolle zurück
async function getMemberRole(
  userId: string,
  organizationId: string
): Promise<OrganizationRole | null> {
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    select: { role: true, isActive: true },
  });

  if (!member || !member.isActive) return null;
  return member.role;
}

// POST /api/organizations/[id]/invite - Neues Mitglied einladen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const body = await request.json();
    const { email, role, message } = body;

    // Validierung
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "E-Mail-Adresse erforderlich" },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json(
        { error: "Ungültige E-Mail-Adresse" },
        { status: 400 }
      );
    }

    // Nur OWNER und ADMIN dürfen einladen
    const inviterRole = await getMemberRole(session.user.id, organizationId);
    if (!inviterRole || (inviterRole !== "OWNER" && inviterRole !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Einladen" },
        { status: 403 }
      );
    }

    // Rolle validieren (kann nicht höher sein als eigene Rolle)
    const validRoles: OrganizationRole[] = ["MEMBER", "MANAGER", "ADMIN"];
    if (inviterRole === "ADMIN") {
      // Admin kann nur MEMBER und MANAGER einladen
      validRoles.pop(); // Remove ADMIN
    }

    const inviteRole: OrganizationRole = validRoles.includes(role)
      ? role
      : "MEMBER";

    // Organisation und Mitgliederlimit prüfen
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: { members: { where: { isActive: true } } },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organisation nicht gefunden" },
        { status: 404 }
      );
    }

    if (organization._count.members >= organization.maxMembers) {
      return NextResponse.json(
        {
          error: `Mitgliederlimit erreicht (${organization.maxMembers}). Bitte upgraden Sie Ihren Plan.`,
        },
        { status: 400 }
      );
    }

    // Prüfen ob User schon Mitglied ist
    const existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember?.isActive) {
        return NextResponse.json(
          { error: "Diese Person ist bereits Mitglied" },
          { status: 400 }
        );
      }
    }

    // Prüfen ob bereits eine ausstehende Einladung existiert
    const existingInvite = await prisma.organizationInvite.findFirst({
      where: {
        organizationId,
        email: emailLower,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "Es existiert bereits eine ausstehende Einladung für diese E-Mail" },
        { status: 400 }
      );
    }

    // Einladung erstellen (7 Tage gültig)
    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId,
        email: emailLower,
        role: inviteRole,
        invitedBy: session.user.id,
        message: message?.trim() || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 Tage
      },
    });

    // E-Mail senden (im Hintergrund, blockiert nicht die Response)
    sendInviteEmail(
      emailLower,
      invite.token,
      organizationId,
      organization.name,
      session.user.name || null,
      inviteRole,
      message?.trim()
    ).catch((err) => {
      console.error("Failed to send invite email:", err);
    });

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteLink: `${process.env.NEXTAUTH_URL || "https://performanty.de"}/invite/${invite.token}`,
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Einladung" },
      { status: 500 }
    );
  }
}

// GET /api/organizations/[id]/invite - Alle Einladungen abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId } = await params;

    // Prüfen ob User Mitglied ist
    const role = await getMemberRole(session.user.id, organizationId);
    if (!role) {
      return NextResponse.json(
        { error: "Kein Zugriff auf diese Organisation" },
        { status: 403 }
      );
    }

    const invites = await prisma.organizationInvite.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Einladungen" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]/invite?inviteId=xxx - Einladung widerrufen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("inviteId");

    if (!inviteId) {
      return NextResponse.json(
        { error: "Einladungs-ID erforderlich" },
        { status: 400 }
      );
    }

    // Nur OWNER und ADMIN dürfen widerrufen
    const role = await getMemberRole(session.user.id, organizationId);
    if (!role || (role !== "OWNER" && role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Einladung finden und prüfen
    const invite = await prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Einladung nicht gefunden" },
        { status: 404 }
      );
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Nur ausstehende Einladungen können widerrufen werden" },
        { status: 400 }
      );
    }

    // Einladung widerrufen
    await prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invite:", error);
    return NextResponse.json(
      { error: "Fehler beim Widerrufen der Einladung" },
      { status: 500 }
    );
  }
}
