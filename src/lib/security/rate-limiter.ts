/**
 * In-Memory Rate Limiter for Authentication
 *
 * Prevents brute-force attacks by limiting login attempts per IP/email
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

// Store for rate limiting (in production, use Redis)
const loginAttempts = new Map<string, RateLimitEntry>();

// Configuration
const CONFIG = {
  maxAttempts: 5,           // Max attempts before blocking
  windowMs: 15 * 60 * 1000, // 15 minute window
  blockDurationMs: 30 * 60 * 1000, // 30 minute block
  cleanupIntervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
};

// Cleanup old entries periodically
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of loginAttempts.entries()) {
      // Remove entries older than window + block duration
      if (now - entry.firstAttempt > CONFIG.windowMs + CONFIG.blockDurationMs) {
        loginAttempts.delete(key);
      }
    }
  }, CONFIG.cleanupIntervalMs);
}

// Start cleanup on module load
if (typeof window === 'undefined') {
  startCleanup();
}

/**
 * Check if a login attempt is allowed
 * @param identifier - Email or IP address
 * @returns Object with allowed status and remaining time if blocked
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil?: Date;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const key = identifier.toLowerCase();
  const entry = loginAttempts.get(key);

  // No previous attempts
  if (!entry) {
    return { allowed: true, remainingAttempts: CONFIG.maxAttempts };
  }

  // Check if currently blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: new Date(entry.blockedUntil),
      retryAfterSeconds,
    };
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > CONFIG.windowMs) {
    loginAttempts.delete(key);
    return { allowed: true, remainingAttempts: CONFIG.maxAttempts };
  }

  // Check if max attempts reached
  if (entry.count >= CONFIG.maxAttempts) {
    // Block the user
    entry.blockedUntil = now + CONFIG.blockDurationMs;
    loginAttempts.set(key, entry);

    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: new Date(entry.blockedUntil),
      retryAfterSeconds: Math.ceil(CONFIG.blockDurationMs / 1000),
    };
  }

  return {
    allowed: true,
    remainingAttempts: CONFIG.maxAttempts - entry.count,
  };
}

/**
 * Record a failed login attempt
 * @param identifier - Email or IP address
 */
export function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const key = identifier.toLowerCase();
  const entry = loginAttempts.get(key);

  if (!entry) {
    loginAttempts.set(key, {
      count: 1,
      firstAttempt: now,
    });
    return;
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > CONFIG.windowMs) {
    loginAttempts.set(key, {
      count: 1,
      firstAttempt: now,
    });
    return;
  }

  // Increment count
  entry.count++;
  loginAttempts.set(key, entry);
}

/**
 * Clear rate limit for an identifier (e.g., after successful login)
 * @param identifier - Email or IP address
 */
export function clearRateLimit(identifier: string): void {
  loginAttempts.delete(identifier.toLowerCase());
}

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus(): {
  activeEntries: number;
  blockedCount: number;
} {
  const now = Date.now();
  let blockedCount = 0;

  for (const entry of loginAttempts.values()) {
    if (entry.blockedUntil && now < entry.blockedUntil) {
      blockedCount++;
    }
  }

  return {
    activeEntries: loginAttempts.size,
    blockedCount,
  };
}
