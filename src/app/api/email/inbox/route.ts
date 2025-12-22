import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const deleteSchema = z.object({
  emailIds: z.array(z.string()).min(1),
});

// GET /api/email/inbox - Get received emails
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const rowId = searchParams.get("rowId");
    const direction = searchParams.get("direction"); // "INBOUND" | "OUTBOUND" | null (all)
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get user's email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const accountIds = accounts.map(a => a.id);

    if (accountIds.length === 0) {
      return NextResponse.json({ emails: [], total: 0, page, pages: 0 });
    }

    // Build where clause
    const where: {
      emailAccountId: { in: string[] } | string;
      rowId?: string;
      direction?: "INBOUND" | "OUTBOUND";
    } = {
      emailAccountId: accountId ? accountId : { in: accountIds },
    };

    if (rowId) where.rowId = rowId;
    if (direction === "INBOUND" || direction === "OUTBOUND") {
      where.direction = direction;
    }

    // Get emails
    const [emails, total] = await Promise.all([
      prisma.emailMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          row: {
            select: {
              id: true,
              cells: {
                where: { column: { type: { in: ["COMPANY", "PERSON", "EMAIL"] } } },
                include: { column: { select: { type: true, name: true } } },
              },
            },
          },
          template: { select: { id: true, name: true } },
          emailAccount: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.emailMessage.count({ where }),
    ]);

    // Format emails with contact info
    const formattedEmails = emails.map(email => {
      let contactName = email.direction === "INBOUND" ? email.fromName : email.toName;
      let contactEmail = email.direction === "INBOUND" ? email.fromEmail : email.toEmail;

      // Try to get name from row if available
      if (email.row?.cells) {
        const companyCell = email.row.cells.find(c => c.column.type === "COMPANY");
        const personCell = email.row.cells.find(c => c.column.type === "PERSON");
        if (companyCell?.value && typeof companyCell.value === "string") {
          contactName = companyCell.value;
        } else if (personCell?.value && typeof personCell.value === "string") {
          contactName = personCell.value;
        }
      }

      return {
        id: email.id,
        direction: email.direction,
        status: email.status,
        contactName: contactName || contactEmail,
        contactEmail,
        subject: email.subject,
        preview: email.bodyText?.substring(0, 150) || "",
        bodyHtml: email.bodyHtml,
        bodyText: email.bodyText,
        hasAttachments: (email.attachments as unknown[])?.length > 0,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
        rowId: email.rowId,
        account: email.emailAccount,
        openCount: email.openCount,
        clickCount: email.clickCount,
      };
    });

    return NextResponse.json({
      emails: formattedEmails,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error getting inbox:", error);
    return NextResponse.json({ error: "Fehler beim Abrufen der E-Mails" }, { status: 500 });
  }
}

// DELETE /api/email/inbox - Delete emails
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { emailIds } = deleteSchema.parse(body);

    // Get user's email accounts to verify ownership
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const accountIds = accounts.map(a => a.id);

    if (accountIds.length === 0) {
      return NextResponse.json({ error: "Keine E-Mail-Konten gefunden" }, { status: 400 });
    }

    // Delete emails that belong to user's accounts
    const result = await prisma.emailMessage.deleteMany({
      where: {
        id: { in: emailIds },
        emailAccountId: { in: accountIds },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error("Error deleting emails:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
    }
    return NextResponse.json({ error: "Fehler beim Loeschen der E-Mails" }, { status: 500 });
  }
}
