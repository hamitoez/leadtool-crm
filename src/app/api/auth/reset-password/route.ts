import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/security/tokens";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token ist erforderlich"),
  password: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten"),
});

// GET: Verify token validity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token ist erforderlich" },
        { status: 400 }
      );
    }

    const result = await verifyPasswordResetToken(token);

    return NextResponse.json({
      valid: result.valid,
      error: result.error,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { valid: false, error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}

// POST: Reset the password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Verify the token
    const tokenResult = await verifyPasswordResetToken(token);

    if (!tokenResult.valid || !tokenResult.userId) {
      return NextResponse.json(
        { error: tokenResult.error || "Ungültiger oder abgelaufener Token" },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user's password
    await prisma.user.update({
      where: { id: tokenResult.userId },
      data: { password: hashedPassword },
    });

    // Mark the token as used
    await consumePasswordResetToken(token);

    // Invalidate all existing sessions for this user (security measure)
    await prisma.session.deleteMany({
      where: { userId: tokenResult.userId },
    });

    return NextResponse.json({
      message: "Passwort wurde erfolgreich zurückgesetzt. Du kannst dich jetzt anmelden.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
      { status: 500 }
    );
  }
}
