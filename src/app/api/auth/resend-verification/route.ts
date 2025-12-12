import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createVerificationToken } from "@/lib/security/tokens";
import { sendVerificationEmail } from "@/lib/email/resend";

// Rate limiting: Track resend attempts
const resendAttempts = new Map<string, { count: number; lastAttempt: Date }>();

const RESEND_CONFIG = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
};

function checkResendLimit(email: string): { allowed: boolean; waitTime?: number } {
  const now = new Date();
  const attempts = resendAttempts.get(email);

  if (!attempts) {
    return { allowed: true };
  }

  const timeSinceFirst = now.getTime() - attempts.lastAttempt.getTime();

  // Reset if window has passed
  if (timeSinceFirst > RESEND_CONFIG.windowMs) {
    resendAttempts.delete(email);
    return { allowed: true };
  }

  if (attempts.count >= RESEND_CONFIG.maxAttempts) {
    const waitTime = Math.ceil((RESEND_CONFIG.windowMs - timeSinceFirst) / 1000 / 60);
    return { allowed: false, waitTime };
  }

  return { allowed: true };
}

function recordResendAttempt(email: string) {
  const attempts = resendAttempts.get(email);
  if (attempts) {
    attempts.count++;
    attempts.lastAttempt = new Date();
  } else {
    resendAttempts.set(email, { count: 1, lastAttempt: new Date() });
  }
}

const resendSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = resendSchema.parse(body);

    // Check rate limit
    const rateCheck = checkResendLimit(email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Zu viele Anfragen. Bitte warte ${rateCheck.waitTime} Minuten.`,
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "Falls ein Account mit dieser E-Mail existiert, wurde eine Bestätigungs-E-Mail gesendet.",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        message: "Deine E-Mail-Adresse ist bereits bestätigt. Du kannst dich anmelden.",
        alreadyVerified: true,
      });
    }

    // Record the attempt
    recordResendAttempt(email);

    // Create new verification token
    const token = await createVerificationToken(email);

    // Send verification email
    await sendVerificationEmail(email, token, user.name || undefined);

    return NextResponse.json({
      message: "Bestätigungs-E-Mail wurde gesendet. Bitte überprüfe deinen Posteingang.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
      { status: 500 }
    );
  }
}
