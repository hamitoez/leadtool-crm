import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Environment
  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Debug mode (disable in production)
  debug: false,

  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive request data
    if (event.request) {
      if (event.request.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      if (event.request.data) {
        // Parse and sanitize request body
        try {
          const data = typeof event.request.data === "string"
            ? JSON.parse(event.request.data)
            : event.request.data;

          // Remove sensitive fields
          const sensitiveFields = ["password", "token", "apiKey", "secret", "twoFactorSecret"];
          sensitiveFields.forEach((field) => {
            if (data[field]) {
              data[field] = "[REDACTED]";
            }
          });

          event.request.data = JSON.stringify(data);
        } catch {
          // If parsing fails, keep original data
        }
      }
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Expected auth errors
    "Invalid credentials",
    "EMAIL_NOT_VERIFIED",
    "2FA_REQUIRED",
    // Rate limiting
    "Too many login attempts",
    "Too many requests",
  ],
});
