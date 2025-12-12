import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { createVerificationToken } from "@/lib/security/tokens";
import { sendVerificationEmail } from "@/lib/email/resend";
import { registerApiSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = registerApiSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // If user exists but email not verified, allow resending verification
      if (!existingUser.emailVerified) {
        return NextResponse.json(
          {
            error: "Ein Account mit dieser E-Mail existiert bereits. Bitte bestätige deine E-Mail oder fordere einen neuen Bestätigungslink an.",
            code: "EMAIL_EXISTS_UNVERIFIED",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Ein Account mit dieser E-Mail existiert bereits." },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (without email verification)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        // emailVerified is null by default - user needs to verify
      },
    });

    // Create verification token
    const token = await createVerificationToken(email);

    // Send verification email
    try {
      await sendVerificationEmail(email, token, name || undefined);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails, user can resend
    }

    return NextResponse.json(
      {
        message: "Registrierung erfolgreich! Bitte überprüfe deine E-Mails und bestätige deine E-Mail-Adresse.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
      { status: 500 }
    );
  }
}
