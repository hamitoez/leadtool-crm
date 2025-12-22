import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { OrganizationRole } from "@prisma/client";

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

// GET /api/organizations/[id] - Organisation Details abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prüfen ob User Mitglied ist
    const role = await getMemberRole(session.user.id, id);
    if (!role) {
      return NextResponse.json(
        { error: "Kein Zugriff auf diese Organisation" },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        invites: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organisation nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      logo: organization.logo,
      plan: organization.plan,
      maxMembers: organization.maxMembers,
      settings: organization.settings,
      myRole: role,
      members: organization.members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt,
        lastActiveAt: m.lastActiveAt,
      })),
      pendingInvites: organization.invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
      projectCount: organization._count.projects,
      createdAt: organization.createdAt,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Organisation" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id] - Organisation bearbeiten
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Nur OWNER und ADMIN dürfen bearbeiten
    const role = await getMemberRole(session.user.id, id);
    if (!role || (role !== "OWNER" && role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Bearbeiten" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, logo, settings } = body;

    const updateData: {
      name?: string;
      description?: string | null;
      logo?: string | null;
      settings?: object;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Name muss mindestens 2 Zeichen haben" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (logo !== undefined) {
      updateData.logo = logo || null;
    }

    if (settings !== undefined) {
      updateData.settings = settings;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      logo: organization.logo,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Organisation" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id] - Organisation löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Nur OWNER darf löschen
    const role = await getMemberRole(session.user.id, id);
    if (role !== "OWNER") {
      return NextResponse.json(
        { error: "Nur der Eigentümer kann die Organisation löschen" },
        { status: 403 }
      );
    }

    // Prüfen ob noch Projekte existieren
    const projectCount = await prisma.project.count({
      where: { organizationId: id },
    });

    if (projectCount > 0) {
      return NextResponse.json(
        {
          error: `Die Organisation hat noch ${projectCount} Projekt(e). Bitte erst alle Projekte löschen oder übertragen.`,
        },
        { status: 400 }
      );
    }

    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Organisation" },
      { status: 500 }
    );
  }
}
