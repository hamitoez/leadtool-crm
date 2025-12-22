import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/organizations/invite?token=xxx - Einladungsdetails abrufen (ohne Login)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token erforderlich" },
        { status: 400 }
      );
    }

    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
            logo: true,
            _count: { select: { members: { where: { isActive: true } } } },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Einladung nicht gefunden" },
        { status: 404 }
      );
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Diese Einladung wurde bereits verwendet oder widerrufen" },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Diese Einladung ist abgelaufen" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      message: invite.message,
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
        description: invite.organization.description,
        logo: invite.organization.logo,
        memberCount: invite.organization._count.members,
      },
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Einladung" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/invite - Einladung annehmen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token erforderlich" },
        { status: 400 }
      );
    }

    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Einladung nicht gefunden" },
        { status: 404 }
      );
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Diese Einladung wurde bereits verwendet oder widerrufen" },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      // Einladung als abgelaufen markieren
      await prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Diese Einladung ist abgelaufen" },
        { status: 400 }
      );
    }

    // Prüfen ob User E-Mail zur Einladung passt (optional, kann auch andere E-Mail haben)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    // Prüfen ob User bereits Mitglied ist
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (existingMember?.isActive) {
      // Einladung als akzeptiert markieren (user ist schon Mitglied)
      await prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return NextResponse.json(
        { error: "Sie sind bereits Mitglied dieser Organisation" },
        { status: 400 }
      );
    }

    // Einladung annehmen und Mitgliedschaft erstellen
    await prisma.$transaction(async (tx) => {
      // Mitgliedschaft erstellen oder reaktivieren
      if (existingMember) {
        await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: {
            isActive: true,
            role: invite.role,
            joinedAt: new Date(),
          },
        });
      } else {
        await tx.organizationMember.create({
          data: {
            organizationId: invite.organizationId,
            userId: session.user.id,
            role: invite.role,
            invitedBy: invite.invitedBy,
            joinedAt: new Date(),
          },
        });
      }

      // Einladung als akzeptiert markieren
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
        slug: invite.organization.slug,
      },
      role: invite.role,
      email: user?.email,
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      { error: "Fehler beim Annehmen der Einladung" },
      { status: 500 }
    );
  }
}
