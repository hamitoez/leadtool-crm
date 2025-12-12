import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  verifyTOTPCode,
  encryptTOTPSecret,
  generateBackupCodes,
  hashBackupCode,
  formatBackupCode,
} from "@/lib/security/totp";

const verifySchema = z.object({
  secret: z.string().min(16, "Ungültiges Secret"),
  code: z.string().length(6, "Code muss 6 Ziffern haben"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { secret, code } = verifySchema.parse(body);

    // Verify the TOTP code
    const isValid = verifyTOTPCode(secret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: "Ungültiger Code. Bitte versuche es erneut." },
        { status: 400 }
      );
    }

    // Check if user already has 2FA enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    });

    if (user?.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA ist bereits aktiviert" },
        { status: 400 }
      );
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (code) => ({
        code: await hashBackupCode(code),
        userId: session.user.id,
      }))
    );

    // Encrypt and save the secret, enable 2FA
    const encryptedSecret = encryptTOTPSecret(secret);

    await prisma.$transaction([
      // Update user with 2FA enabled
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      }),
      // Delete any existing backup codes
      prisma.twoFactorBackupCode.deleteMany({
        where: { userId: session.user.id },
      }),
      // Create new backup codes
      prisma.twoFactorBackupCode.createMany({
        data: hashedBackupCodes,
      }),
    ]);

    // Return backup codes (only shown once!)
    return NextResponse.json({
      message: "2FA wurde erfolgreich aktiviert",
      backupCodes: backupCodes.map(formatBackupCode),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("2FA verify error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}
