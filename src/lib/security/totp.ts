import { authenticator } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "./encryption";

// Configure authenticator
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1, // Allow 1 step before/after for clock drift
};

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

/**
 * Generate the otpauth URL for authenticator apps
 */
export function getTOTPAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, "Performanty", secret);
}

/**
 * Generate a QR code data URL for the TOTP secret
 */
export async function generateQRCode(email: string, secret: string): Promise<string> {
  const otpauthUrl = getTOTPAuthUrl(email, secret);
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
  });
}

/**
 * Encrypt a TOTP secret for storage
 */
export function encryptTOTPSecret(secret: string): string {
  return encrypt(secret);
}

/**
 * Decrypt a TOTP secret from storage
 */
export function decryptTOTPSecret(encryptedSecret: string): string {
  return decrypt(encryptedSecret);
}

/**
 * Generate backup codes (10 codes, 8 characters each)
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    // Generate random 8-character alphanumeric code
    const code = Array.from({ length: 8 }, () =>
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
    ).join("");
    codes.push(code);
  }
  return codes;
}

/**
 * Hash a backup code for storage
 */
export async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code.toUpperCase(), 10);
}

/**
 * Verify a backup code against a hash
 */
export async function verifyBackupCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code.toUpperCase(), hash);
}

/**
 * Format a backup code for display (with dash)
 */
export function formatBackupCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
