import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const importSchema = z.object({
  tableId: z.string().min(1, "Tabellen-ID ist erforderlich"),
  emailColumnId: z.string().min(1, "E-Mail-Spalte ist erforderlich"),
  firstNameColumnId: z.string().optional(),
  lastNameColumnId: z.string().optional(),
  companyColumnId: z.string().optional(),
  additionalColumns: z.array(z.object({
    columnId: z.string(),
    variableName: z.string(),
  })).optional().default([]),
  filterByStatus: z.string().optional(), // z.B. nur bestimmte Status
  skipExisting: z.boolean().optional().default(true),
});

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

    // Kampagne mit Zugriffsrechten laden
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId: session.user.id, isActive: true },
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Kampagne nicht gefunden" },
        { status: 404 }
      );
    }

    const membership = campaign.organization.members[0];
    if (!membership) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Nur OWNER, ADMIN und MANAGER dürfen importieren
    if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Importieren" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = importSchema.parse(body);

    // Tabelle laden und prüfen ob User Zugriff hat
    const table = await prisma.table.findUnique({
      where: { id: validatedData.tableId },
      include: {
        project: true,
        columns: true,
      },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Tabelle nicht gefunden" },
        { status: 404 }
      );
    }

    // Prüfen ob User Zugriff auf die Tabelle hat
    if (table.project.organizationId !== campaign.organizationId &&
        table.project.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung für diese Tabelle" },
        { status: 403 }
      );
    }

    // Spalten-IDs sammeln
    const columnIds = [
      validatedData.emailColumnId,
      validatedData.firstNameColumnId,
      validatedData.lastNameColumnId,
      validatedData.companyColumnId,
      ...validatedData.additionalColumns.map(c => c.columnId),
    ].filter(Boolean) as string[];

    // Rows mit Cells laden
    const rows = await prisma.row.findMany({
      where: { tableId: validatedData.tableId },
      include: {
        cells: {
          where: { columnId: { in: columnIds } },
          include: { column: true },
        },
      },
    });

    // Bereits existierende E-Mails in der Kampagne
    const existingRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { email: true },
    });
    const existingEmails = new Set(existingRecipients.map(r => r.email.toLowerCase()));

    // Empfänger extrahieren
    const recipients: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      variables: Record<string, string>;
      rowId: string;
    }> = [];

    for (const row of rows) {
      const getCellValue = (columnId?: string): string | undefined => {
        if (!columnId) return undefined;
        const cell = row.cells.find(c => c.columnId === columnId);
        if (!cell || cell.value === null) return undefined;

        // Value kann verschiedene Typen haben
        const val = cell.value;
        if (typeof val === "string") return val;
        if (typeof val === "object" && val !== null && "value" in val) {
          return String((val as { value: unknown }).value);
        }
        return String(val);
      };

      const email = getCellValue(validatedData.emailColumnId);
      if (!email || !email.includes("@")) continue;

      const emailLower = email.toLowerCase();

      // Skip wenn bereits existiert
      if (validatedData.skipExisting && existingEmails.has(emailLower)) {
        continue;
      }

      // Zusätzliche Variablen
      const variables: Record<string, string> = {};
      for (const col of validatedData.additionalColumns) {
        const value = getCellValue(col.columnId);
        if (value) {
          variables[col.variableName] = value;
        }
      }

      recipients.push({
        email: emailLower,
        firstName: getCellValue(validatedData.firstNameColumnId),
        lastName: getCellValue(validatedData.lastNameColumnId),
        company: getCellValue(validatedData.companyColumnId),
        variables,
        rowId: row.id,
      });
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: rows.length,
        message: "Keine neuen Empfänger gefunden. Alle E-Mail-Adressen existieren bereits oder sind ungültig.",
      });
    }

    // Empfänger erstellen
    await prisma.campaignRecipient.createMany({
      data: recipients.map(r => ({
        campaignId,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        company: r.company,
        variables: r.variables,
        rowId: r.rowId,
      })),
    });

    // Recipient count aktualisieren
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        recipientCount: { increment: recipients.length },
      },
    });

    return NextResponse.json({
      success: true,
      imported: recipients.length,
      skipped: rows.length - recipients.length,
      message: `${recipients.length} Empfänger erfolgreich importiert`,
    });
  } catch (error) {
    console.error("Error importing recipients:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to import recipients" },
      { status: 500 }
    );
  }
}
