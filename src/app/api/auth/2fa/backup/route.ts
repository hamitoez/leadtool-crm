import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyBackupCode } from "@/lib/security/totp";

const backupSchema = z.object({
  userId: z.string().min(1, "User ID ist erforderlich"),
  code: z.string().min(8, "Backup Code muss mindestens 8 Zeichen haben"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = backupSchema.parse(body);

    // Normalize the code (remove dashes, uppercase)
    const normalizedCode = code.replace(/-/g, "").toUpperCase();

    // Get user's backup codes
    const backupCodes = await prisma.twoFactorBackupCode.findMany({
      where: {
        userId,
        usedAt: null, // Only unused codes
      },
    });

    if (backupCodes.length === 0) {
      return NextResponse.json(
        { valid: false, error: "Keine gültigen Backup-Codes vorhanden" },
        { status: 400 }
      );
    }

    // Check each backup code
    let validCodeId: string | null = null;
    for (const backupCode of backupCodes) {
      const isValid = await verifyBackupCode(normalizedCode, backupCode.code);
      if (isValid) {
        validCodeId = backupCode.id;
        break;
      }
    }

    if (!validCodeId) {
      return NextResponse.json(
        { valid: false, error: "Ungültiger Backup-Code" },
        { status: 400 }
      );
    }

    // Mark the backup code as used
    await prisma.twoFactorBackupCode.update({
      where: { id: validCodeId },
      data: { usedAt: new Date() },
    });

    // Count remaining backup codes
    const remainingCodes = await prisma.twoFactorBackupCode.count({
      where: {
        userId,
        usedAt: null,
      },
    });

    return NextResponse.json({
      valid: true,
      remainingCodes,
      message: remainingCodes <= 2
        ? `Achtung: Nur noch ${remainingCodes} Backup-Codes übrig!`
        : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { valid: false, error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Backup code verification error:", error);
    return NextResponse.json(
      { valid: false, error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}
