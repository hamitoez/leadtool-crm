import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),

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

  // Sync
  syncEnabled: z.boolean().optional(),

  // Signature
  signature: z.string().optional(),

  // Marketing Settings
  dailyLimit: z.number().int().min(1).max(1000).optional(),
});

// GET /api/email/accounts/[accountId] - Get a single email account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await params;

    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
      include: {
        _count: { select: { emails: true } },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Don't return passwords
    const { smtpPassword, imapPassword, accessToken, refreshToken, ...safeAccount } = account;

    return NextResponse.json({
      ...safeAccount,
      hasSmtpPassword: !!smtpPassword,
      hasImapPassword: !!imapPassword,
      hasOAuthTokens: !!accessToken,
    });
  } catch (error) {
    console.error("Error fetching email account:", error);
    return NextResponse.json({ error: "Failed to fetch email account" }, { status: 500 });
  }
}

// PATCH /api/email/accounts/[accountId] - Update an email account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await params;
    const body = await request.json();
    const data = updateAccountSchema.parse(body);

    // Verify ownership
    const existing = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { userId: session.user.id, isDefault: true, id: { not: accountId } },
        data: { isDefault: false },
      });
    }

    const account = await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        ...data,
        // Only update password if provided
        smtpPassword: data.smtpPassword || undefined,
        imapPassword: data.imapPassword || undefined,
      },
    });

    // Don't return passwords
    const { smtpPassword, imapPassword, accessToken, refreshToken, ...safeAccount } = account;

    return NextResponse.json(safeAccount);
  } catch (error) {
    console.error("Error updating email account:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update email account" }, { status: 500 });
  }
}

// DELETE /api/email/accounts/[accountId] - Delete an email account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await params;

    // Verify ownership
    const existing = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await prisma.emailAccount.delete({
      where: { id: accountId },
    });

    // If deleted was default, set another as default
    if (existing.isDefault) {
      const another = await prisma.emailAccount.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      });
      if (another) {
        await prisma.emailAccount.update({
          where: { id: another.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email account:", error);
    return NextResponse.json({ error: "Failed to delete email account" }, { status: 500 });
  }
}
