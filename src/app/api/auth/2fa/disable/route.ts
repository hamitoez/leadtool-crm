import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { verifyTOTPCode, decryptTOTPSecret } from "@/lib/security/totp";

const disableSchema = z.object({
  password: z.string().min(1, "Passwort ist erforderlich"),
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
    const { password, code } = disableSchema.parse(body);

    // Get user with password and 2FA info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        password: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA ist nicht aktiviert" },
        { status: 400 }
      );
    }

    // Verify password (only for credential users)
    if (user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Ungültiges Passwort" },
          { status: 400 }
        );
      }
    }

    // Verify TOTP code
    const secret = decryptTOTPSecret(user.twoFactorSecret);
    const isCodeValid = verifyTOTPCode(secret, code);

    if (!isCodeValid) {
      return NextResponse.json(
        { error: "Ungültiger 2FA-Code" },
        { status: 400 }
      );
    }

    // Disable 2FA and delete backup codes
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      }),
      prisma.twoFactorBackupCode.deleteMany({
        where: { userId: session.user.id },
      }),
    ]);

    return NextResponse.json({
      message: "2FA wurde erfolgreich deaktiviert",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("2FA disable error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}
