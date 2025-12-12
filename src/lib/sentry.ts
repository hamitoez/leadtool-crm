import * as Sentry from "@sentry/nextjs";
import { NextRequest } from "next/server";

/**
 * Capture an API error with additional context
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
  Sentry.withScope((scope) => {
    if (context?.route) {
      scope.setTag("api.route", context.route);
    }
    if (context?.method) {
      scope.setTag("api.method", context.method);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), "error");
    }
  });
}

/**
 * Capture an API error from a request object
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
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  name?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = "info"
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Track a custom event
 */
export function trackEvent(
  name: string,
  data?: Record<string, unknown>
) {
  Sentry.captureMessage(name, {
    level: "info",
    extra: data,
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string
) {
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

/**
 * Wrapper for API route handlers with error tracking
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
