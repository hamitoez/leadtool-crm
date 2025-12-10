/**
 * Encryption utilities for sensitive data (API Keys)
 *
 * Uses AES-256-GCM for encryption with a server-side secret
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Get encryption key from environment (or generate a fallback for development)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || process.env.AUTH_SECRET || 'leadtool-dev-secret-change-in-production';

// Derive a 32-byte key from the secret
const getEncryptionKey = (): Buffer => {
  return scryptSync(ENCRYPTION_SECRET, 'leadtool-salt', 32);
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string value
 * @param plaintext - The value to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param encryptedValue - The encrypted value in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return '';

  // Check if it's already plaintext (for migration)
  if (!encryptedValue.includes(':')) {
    // Likely plaintext, return as-is (but log warning)
    console.warn('Warning: Encountered unencrypted value, returning as-is');
    return encryptedValue;
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    console.warn('Warning: Invalid encrypted format, returning as-is');
    return encryptedValue;
  }

  try {
    const key = getEncryptionKey();
    const [ivBase64, authTagBase64, ciphertext] = parts;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return empty string on decryption failure (don't expose encrypted data)
    return '';
  }
}

/**
 * Check if a value is encrypted
 * @param value - The value to check
 * @returns True if the value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

/**
 * Mask an API key for display (shows first 4 and last 4 characters)
 * @param apiKey - The API key to mask
 * @returns Masked API key like "sk-a***************xyz1"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '***';
  }
  const prefix = apiKey.substring(0, 7);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}${'*'.repeat(8)}${suffix}`;
}
