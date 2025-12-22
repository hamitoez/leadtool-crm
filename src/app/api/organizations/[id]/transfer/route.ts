import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/organizations/[id]/transfer - Ownership übertragen
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
    const { newOwnerId } = body;

    if (!newOwnerId) {
      return NextResponse.json(
        { error: "Neuer Owner erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob aktueller User OWNER ist
    const currentOwner = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: session.user.id },
      },
    });

    if (!currentOwner || currentOwner.role !== "OWNER") {
      return NextResponse.json(
        { error: "Nur der aktuelle Owner kann die Ownership übertragen" },
        { status: 403 }
      );
    }

    // Prüfen ob neuer Owner Mitglied ist
    const newOwner = await prisma.organizationMember.findFirst({
      where: { organizationId, userId: newOwnerId, isActive: true },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!newOwner) {
      return NextResponse.json(
        { error: "Der neue Owner muss ein aktives Mitglied sein" },
        { status: 400 }
      );
    }

    // Ownership übertragen in einer Transaktion
    await prisma.$transaction([
      // Aktuellen Owner zu ADMIN herabstufen
      prisma.organizationMember.update({
        where: { id: currentOwner.id },
        data: { role: "ADMIN" },
      }),
      // Neuen Owner ernennen
      prisma.organizationMember.update({
        where: { id: newOwner.id },
        data: { role: "OWNER" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      newOwner: {
        id: newOwner.userId,
        name: newOwner.user.name,
        email: newOwner.user.email,
      },
    });
  } catch (error) {
    console.error("Error transferring ownership:", error);
    return NextResponse.json(
      { error: "Fehler beim Übertragen der Ownership" },
      { status: 500 }
    );
  }
}
