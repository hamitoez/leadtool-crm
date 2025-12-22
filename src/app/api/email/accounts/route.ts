import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  accountType: z.enum(["SMTP_IMAP", "GMAIL", "OUTLOOK"]).default("SMTP_IMAP"),
  isDefault: z.boolean().optional(),

  // SMTP Settings
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),

  // IMAP Settings
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapUser: z.string().optional(),
  imapPassword: z.string().optional(),

  // Signature
  signature: z.string().optional(),

  // Marketing Settings
  dailyLimit: z.number().int().min(1).max(1000).optional(),
});

// GET /api/email/accounts - Get all email accounts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        isDefault: true,
        isActive: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        imapHost: true,
        imapPort: true,
        imapSecure: true,
        imapUser: true,
        lastSyncAt: true,
        syncEnabled: true,
        signature: true,
        createdAt: true,
        updatedAt: true,
        // Marketing fields
        dailyLimit: true,
        sentToday: true,
        sentTotal: true,
        healthScore: true,
        spfValid: true,
        dkimValid: true,
        dmarcValid: true,
        dnsCheckedAt: true,
        smtpVerified: true,
        imapVerified: true,
        lastVerifiedAt: true,
        verificationError: true,
        isBlocked: true,
        blockedReason: true,
        bounceCount: true,
        _count: { select: { emails: true } },
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error fetching email accounts:", error);
    return NextResponse.json({ error: "Failed to fetch email accounts" }, { status: 500 });
  }
}

// POST /api/email/accounts - Create a new email account
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createAccountSchema.parse(body);

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if this is the first account (make it default)
    const existingCount = await prisma.emailAccount.count({
      where: { userId: session.user.id },
    });

    const account = await prisma.emailAccount.create({
      data: {
        userId: session.user.id,
        name: data.name,
        email: data.email,
        accountType: data.accountType,
        isDefault: data.isDefault ?? existingCount === 0,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
        smtpUser: data.smtpUser,
        smtpPassword: data.smtpPassword, // TODO: Encrypt before storing
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        imapSecure: data.imapSecure,
        imapUser: data.imapUser,
        imapPassword: data.imapPassword, // TODO: Encrypt before storing
        signature: data.signature,
        dailyLimit: data.dailyLimit ?? 50,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating email account:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create email account" }, { status: 500 });
  }
}
