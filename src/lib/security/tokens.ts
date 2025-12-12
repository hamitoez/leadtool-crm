import { nanoid } from "nanoid";
import prisma from "../prisma";

// Token TTLs
const VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TOKEN_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Create a verification token for email verification
 */
export async function createVerificationToken(email: string): Promise<string> {
  const token = nanoid(32);
  const expires = new Date(Date.now() + VERIFICATION_TOKEN_TTL);

  // Delete any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Create new token
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return token;
}

/**
 * Verify and consume a verification token
 */
export async function verifyVerificationToken(token: string): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    return { valid: false, error: "Token nicht gefunden" };
  }

  if (verificationToken.expires < new Date()) {
    // Delete expired token
    await prisma.verificationToken.delete({
      where: { token },
    });
    return { valid: false, error: "Token ist abgelaufen" };
  }

  // Delete the token (single use)
  await prisma.verificationToken.delete({
    where: { token },
  });

  return { valid: true, email: verificationToken.identifier };
}

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL);

  // Delete any existing unused tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId,
      usedAt: null,
    },
  });

  // Create new token
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

/**
 * Verify a password reset token (does not consume it)
 */
export async function verifyPasswordResetToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!resetToken) {
    return { valid: false, error: "Token nicht gefunden" };
  }

  if (resetToken.usedAt) {
    return { valid: false, error: "Token wurde bereits verwendet" };
  }

  if (resetToken.expiresAt < new Date()) {
    return { valid: false, error: "Token ist abgelaufen" };
  }

  return { valid: true, userId: resetToken.userId };
}

/**
 * Mark a password reset token as used
 */
export async function consumePasswordResetToken(token: string): Promise<boolean> {
  try {
    await prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete expired tokens (cleanup job)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();

  // Delete expired verification tokens
  await prisma.verificationToken.deleteMany({
    where: {
      expires: { lt: now },
    },
  });

  // Delete expired password reset tokens
  await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });
}
