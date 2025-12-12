import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyVerificationToken } from "@/lib/security/tokens";
import { sendWelcomeEmail } from "@/lib/email/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://performanty.de";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(`${APP_URL}/login?error=missing_token`);
    }

    // Verify the token
    const result = await verifyVerificationToken(token);

    if (!result.valid || !result.email) {
      const errorMessage = encodeURIComponent(result.error || "Ungültiger Token");
      return NextResponse.redirect(`${APP_URL}/login?error=verification_failed&message=${errorMessage}`);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: result.email },
    });

    if (!user) {
      return NextResponse.redirect(`${APP_URL}/login?error=user_not_found`);
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.redirect(`${APP_URL}/login?verified=already`);
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name || undefined);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the verification if welcome email fails
    }

    // Redirect to login with success message
    return NextResponse.redirect(`${APP_URL}/login?verified=true`);
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.redirect(`${APP_URL}/login?error=verification_error`);
  }
}
