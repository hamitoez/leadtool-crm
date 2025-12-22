import { NextRequest } from "next/server";

/**
 * Capture an API error with additional context (stub - logs to console)
 */
export function captureAPIError(
  error: unknown,
  context?: {
    route?: string;
    method?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  }
) {
  console.error("API Error:", {
    error,
    route: context?.route,
    method: context?.method,
    userId: context?.userId,
    extra: context?.extra,
  });
}

/**
 * Capture an API error from a request object (stub - logs to console)
 */
export function captureRequestError(
  error: unknown,
  request: NextRequest,
  additionalContext?: Record<string, unknown>
) {
  const url = new URL(request.url);

  captureAPIError(error, {
    route: url.pathname,
    method: request.method,
    extra: {
      query: Object.fromEntries(url.searchParams),
      ...additionalContext,
    },
  });
}

/**
 * Set user context (stub - no-op)
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  name?: string;
}) {
  // No-op stub
}

/**
 * Clear user context (stub - no-op)
 */
export function clearUserContext() {
  // No-op stub
}

/**
 * Add breadcrumb for tracking user actions (stub - no-op)
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: "info" | "warning" | "error" = "info"
) {
  // No-op stub
}

/**
 * Track a custom event (stub - no-op)
 */
export function trackEvent(
  name: string,
  data?: Record<string, unknown>
) {
  // No-op stub
}

/**
 * Start a performance transaction (stub - returns mock)
 */
export function startTransaction(
  name: string,
  op: string
) {
  return {
    finish: () => {},
    setStatus: () => {},
  };
}

/**
 * Wrapper for API route handlers with error tracking (stub - just passes through)
 */
export function withSentryAPI<T>(
  handler: (request: NextRequest, context?: T) => Promise<Response>,
  routeName: string
) {
  return async (request: NextRequest, context?: T): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      captureRequestError(error, request, { routeName });
      throw error;
    }
  };
}
