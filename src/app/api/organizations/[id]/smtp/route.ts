import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { OrganizationRole } from "@prisma/client";
import nodemailer from "nodemailer";

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

// GET /api/organizations/[id]/smtp - SMTP-Einstellungen abrufen
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

    // Nur OWNER und ADMIN dürfen SMTP-Einstellungen sehen
    const role = await getMemberRole(session.user.id, id);
    if (!role || (role !== "OWNER" && role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFrom: true,
        smtpFromName: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organisation nicht gefunden" },
        { status: 404 }
      );
    }

    // Passwort maskieren
    return NextResponse.json({
      smtpHost: org.smtpHost,
      smtpPort: org.smtpPort,
      smtpSecure: org.smtpSecure,
      smtpUser: org.smtpUser,
      smtpPassword: org.smtpPassword ? "********" : null,
      smtpFrom: org.smtpFrom,
      smtpFromName: org.smtpFromName,
      isConfigured: !!(org.smtpHost && org.smtpUser && org.smtpPassword),
    });
  } catch (error) {
    console.error("Error fetching SMTP settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der SMTP-Einstellungen" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id]/smtp - SMTP-Einstellungen aktualisieren
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

    // Nur OWNER und ADMIN dürfen SMTP-Einstellungen ändern
    const role = await getMemberRole(session.user.id, id);
    if (!role || (role !== "OWNER" && role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, smtpFrom, smtpFromName } = body;

    // Update-Daten vorbereiten
    const updateData: {
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpSecure?: boolean;
      smtpUser?: string | null;
      smtpPassword?: string | null;
      smtpFrom?: string | null;
      smtpFromName?: string | null;
    } = {};

    if (smtpHost !== undefined) updateData.smtpHost = smtpHost || null;
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort ? parseInt(smtpPort, 10) : null;
    if (smtpSecure !== undefined) updateData.smtpSecure = !!smtpSecure;
    if (smtpUser !== undefined) updateData.smtpUser = smtpUser || null;
    // Passwort nur aktualisieren wenn nicht maskiert
    if (smtpPassword !== undefined && smtpPassword !== "********") {
      updateData.smtpPassword = smtpPassword || null;
    }
    if (smtpFrom !== undefined) updateData.smtpFrom = smtpFrom || null;
    if (smtpFromName !== undefined) updateData.smtpFromName = smtpFromName || null;

    await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating SMTP settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der SMTP-Einstellungen" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[id]/smtp/test - SMTP-Verbindung testen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Nur OWNER und ADMIN dürfen testen
    const role = await getMemberRole(session.user.id, id);
    if (!role || (role !== "OWNER" && role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFrom: true,
        smtpFromName: true,
      },
    });

    if (!org || !org.smtpHost || !org.smtpUser || !org.smtpPassword) {
      return NextResponse.json(
        { error: "SMTP-Einstellungen unvollständig" },
        { status: 400 }
      );
    }

    // Transporter erstellen und testen
    const transporter = nodemailer.createTransport({
      host: org.smtpHost,
      port: org.smtpPort || 587,
      secure: org.smtpSecure,
      auth: {
        user: org.smtpUser,
        pass: org.smtpPassword,
      },
    });

    try {
      await transporter.verify();
      return NextResponse.json({ success: true, message: "SMTP-Verbindung erfolgreich!" });
    } catch (verifyError) {
      console.error("SMTP verification failed:", verifyError);
      return NextResponse.json(
        {
          error: "SMTP-Verbindung fehlgeschlagen",
          details: verifyError instanceof Error ? verifyError.message : "Unbekannter Fehler"
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error testing SMTP:", error);
    return NextResponse.json(
      { error: "Fehler beim Testen der SMTP-Verbindung" },
      { status: 500 }
    );
  }
}
