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

// Rollenhierarchie für Berechtigungsprüfung
const roleHierarchy: Record<OrganizationRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  MEMBER: 1,
};

// GET /api/organizations/[id]/members - Alle Mitglieder abrufen
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

    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt,
        lastActiveAt: m.lastActiveAt,
        isCurrentUser: m.user.id === session.user.id,
      }))
    );
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Mitglieder" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id]/members - Mitglied-Rolle ändern
export async function PATCH(
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
    const { memberId, role: newRole } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: "Mitglied-ID erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob User Admin/Owner ist
    const myRole = await getMemberRole(session.user.id, organizationId);
    if (!myRole || (myRole !== "OWNER" && myRole !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Bearbeiten" },
        { status: 403 }
      );
    }

    // Ziel-Mitglied finden
    const targetMember = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "Mitglied nicht gefunden" },
        { status: 404 }
      );
    }

    // Kann eigene Rolle nicht ändern
    if (targetMember.userId === session.user.id) {
      return NextResponse.json(
        { error: "Sie können Ihre eigene Rolle nicht ändern" },
        { status: 400 }
      );
    }

    // Kann keine höhere Rolle vergeben als eigene
    if (roleHierarchy[newRole as OrganizationRole] >= roleHierarchy[myRole]) {
      return NextResponse.json(
        { error: "Sie können keine höhere oder gleiche Rolle vergeben" },
        { status: 400 }
      );
    }

    // Kann keine Mitglieder mit höherer/gleicher Rolle bearbeiten
    if (roleHierarchy[targetMember.role] >= roleHierarchy[myRole]) {
      return NextResponse.json(
        { error: "Sie können dieses Mitglied nicht bearbeiten" },
        { status: 400 }
      );
    }

    // OWNER kann nicht geändert werden (außer durch Transfer)
    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        { error: "Die Owner-Rolle kann nicht geändert werden" },
        { status: 400 }
      );
    }

    // Rolle aktualisieren
    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole as OrganizationRole },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      userId: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Mitglieds" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]/members?memberId=xxx - Mitglied entfernen
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
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json(
        { error: "Mitglied-ID erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob User Admin/Owner ist
    const myRole = await getMemberRole(session.user.id, organizationId);
    if (!myRole || (myRole !== "OWNER" && myRole !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Ziel-Mitglied finden
    const targetMember = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "Mitglied nicht gefunden" },
        { status: 404 }
      );
    }

    // Selbst kann man sich entfernen (leave)
    const isSelf = targetMember.userId === session.user.id;

    if (isSelf) {
      // Owner kann sich nicht selbst entfernen
      if (targetMember.role === "OWNER") {
        return NextResponse.json(
          {
            error:
              "Als Owner müssen Sie zuerst einen anderen Owner ernennen, bevor Sie die Organisation verlassen können",
          },
          { status: 400 }
        );
      }
    } else {
      // Kann keine Mitglieder mit höherer/gleicher Rolle entfernen
      if (roleHierarchy[targetMember.role] >= roleHierarchy[myRole]) {
        return NextResponse.json(
          { error: "Sie können dieses Mitglied nicht entfernen" },
          { status: 400 }
        );
      }
    }

    // Mitglied deaktivieren (Soft-Delete)
    await prisma.organizationMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Fehler beim Entfernen des Mitglieds" },
      { status: 500 }
    );
  }
}
