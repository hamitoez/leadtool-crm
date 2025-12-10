/**
 * Security module exports
 */

export { checkRateLimit, recordFailedAttempt, clearRateLimit, getRateLimitStatus } from './rate-limiter';
export { encrypt, decrypt, isEncrypted, maskApiKey } from './encryption';
export {
  requireAuth,
  verifyProjectAccess,
  verifyTableAccess,
  verifyRowAccess,
  verifyCellAccess,
  verifyColumnAccess,
  AuthorizationError,
  isAuthorizationError,
  type AuthContext,
} from './authorization';

// Re-export error handling utilities
export {
  ApiError,
  Errors,
  ErrorCode,
  handleError,
  success,
  withErrorHandler,
  type ErrorCodeType,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type ApiResponse,
} from '../errors';
