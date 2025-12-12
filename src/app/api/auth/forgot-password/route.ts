import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/security/tokens";
import { sendPasswordResetEmail } from "@/lib/email/resend";

// Rate limiting for password reset requests
const resetAttempts = new Map<string, { count: number; lastAttempt: Date }>();

const RESET_CONFIG = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
};

function checkResetLimit(email: string): { allowed: boolean; waitTime?: number } {
  const now = new Date();
  const attempts = resetAttempts.get(email);

  if (!attempts) {
    return { allowed: true };
  }

  const timeSinceFirst = now.getTime() - attempts.lastAttempt.getTime();

  if (timeSinceFirst > RESET_CONFIG.windowMs) {
    resetAttempts.delete(email);
    return { allowed: true };
  }

  if (attempts.count >= RESET_CONFIG.maxAttempts) {
    const waitTime = Math.ceil((RESET_CONFIG.windowMs - timeSinceFirst) / 1000 / 60);
    return { allowed: false, waitTime };
  }

  return { allowed: true };
}

function recordResetAttempt(email: string) {
  const attempts = resetAttempts.get(email);
  if (attempts) {
    attempts.count++;
    attempts.lastAttempt = new Date();
  } else {
    resetAttempts.set(email, { count: 1, lastAttempt: new Date() });
  }
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit
    const rateCheck = checkResetLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Zu viele Anfragen. Bitte warte ${rateCheck.waitTime} Minuten.`,
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    // Record the attempt before processing
    recordResetAttempt(normalizedEmail);

    // Find user - always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user exists and has a password (not OAuth-only), send reset email
    if (user && user.password) {
      try {
        const token = await createPasswordResetToken(user.id);
        await sendPasswordResetEmail(normalizedEmail, token, user.name || undefined);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't expose email sending errors to prevent enumeration
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: "Falls ein Account mit dieser E-Mail existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
      { status: 500 }
    );
  }
}
