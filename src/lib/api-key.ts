import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";

const API_KEY_PREFIX = "ldt_";

// Generiere einen neuen API-Key
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  // 32 Bytes = 256 Bits Entropie
  const randomPart = randomBytes(32).toString("base64url");
  const key = `${API_KEY_PREFIX}${randomPart}`;

  // Hash für sichere Speicherung
  const hash = hashApiKey(key);

  // Prefix für Anzeige (erste 12 Zeichen)
  const prefix = key.substring(0, 12) + "...";

  return { key, hash, prefix };
}

// Hashe einen API-Key für sichere Speicherung
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// API-Key aus Request extrahieren
export function extractApiKey(request: NextRequest): string | null {
  // 1. Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // 2. Check X-API-Key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // 3. Check query parameter (nicht empfohlen, aber für einfache Tests)
  const url = new URL(request.url);
  const apiKeyParam = url.searchParams.get("api_key");
  if (apiKeyParam) {
    return apiKeyParam;
  }

  return null;
}

// Validiere API-Key und gib die zugehörige Organisation zurück
export async function validateApiKey(key: string): Promise<{
  valid: boolean;
  organizationId?: string;
  apiKeyId?: string;
  scopes?: string[];
  error?: string;
}> {
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: "Invalid API key format" };
  }

  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!apiKey) {
    return { valid: false, error: "Invalid API key" };
  }

  if (!apiKey.isActive) {
    return { valid: false, error: "API key is inactive" };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      requestCount: { increment: 1 },
    },
  }).catch(() => {
    // Ignore errors
  });

  return {
    valid: true,
    organizationId: apiKey.organizationId,
    apiKeyId: apiKey.id,
    scopes: apiKey.scopes,
  };
}

// Prüfe ob ein Scope erlaubt ist
export function hasScope(scopes: string[], requiredScope: string): boolean {
  // Wildcard support: "leads:*" matches "leads:read" and "leads:write"
  return scopes.some((scope) => {
    if (scope === "*") return true;
    if (scope === requiredScope) return true;

    const [resource, action] = requiredScope.split(":");
    if (scope === `${resource}:*`) return true;

    return false;
  });
}

// Rate Limiting Check (einfache In-Memory Implementierung)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(apiKeyId: string, limit: number = 1000): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  let entry = rateLimitMap.get(apiKeyId);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + hourMs };
    rateLimitMap.set(apiKeyId, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

// API Response Helper
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export function apiError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    error: { code, message, details },
  };
}

export function apiSuccess<T>(
  data: T,
  meta?: ApiSuccessResponse<T>["meta"]
): ApiSuccessResponse<T> {
  return { data, meta };
}
