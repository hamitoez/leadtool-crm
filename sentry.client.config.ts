import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Debug mode (disable in production)
  debug: false,

  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }

    // Remove sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data) {
          // Remove potential sensitive fields
          const { password, token, apiKey, secret, ...safeData } = breadcrumb.data;
          breadcrumb.data = safeData;
        }
        return breadcrumb;
      });
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Browser-specific errors that are not actionable
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Network errors
    "Network request failed",
    "Failed to fetch",
    // Auth-related (expected errors)
    "Invalid credentials",
    "EMAIL_NOT_VERIFIED",
    "2FA_REQUIRED",
  ],
});
