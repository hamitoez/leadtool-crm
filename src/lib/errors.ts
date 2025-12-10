/**
 * Standardized Error Handling for LeadTool API
 * Provides consistent error responses across all API routes
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

// Standard error codes
export const ErrorCode = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Rate Limiting
  RATE_LIMITED: "RATE_LIMITED",

  // Server Errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// Error response interface
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCodeType;
    message: string;
    details?: unknown;
  };
}

// Success response interface
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCodeType,
    message: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toResponse(): NextResponse<ApiErrorResponse> {
    const errorBody: { code: ErrorCodeType; message: string; details?: unknown } = {
      code: this.code,
      message: this.message,
    };
    if (this.details) {
      errorBody.details = this.details;
    }
    return NextResponse.json(
      {
        success: false as const,
        error: errorBody,
      },
      { status: this.statusCode }
    );
  }
}

// Pre-built error factories
export const Errors = {
  unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(ErrorCode.UNAUTHORIZED, message, 401);
  },

  forbidden(message = "Access denied"): ApiError {
    return new ApiError(ErrorCode.FORBIDDEN, message, 403);
  },

  notFound(resource = "Resource"): ApiError {
    return new ApiError(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
  },

  validationError(details: unknown): ApiError {
    return new ApiError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid request data",
      400,
      details
    );
  },

  conflict(message = "Resource already exists"): ApiError {
    return new ApiError(ErrorCode.CONFLICT, message, 409);
  },

  rateLimited(retryAfter?: number): ApiError {
    const message = retryAfter
      ? `Too many requests. Try again in ${retryAfter} seconds`
      : "Too many requests";
    return new ApiError(ErrorCode.RATE_LIMITED, message, 429);
  },

  internal(message = "Internal server error"): ApiError {
    return new ApiError(ErrorCode.INTERNAL_ERROR, message, 500);
  },

  serviceUnavailable(service = "Service"): ApiError {
    return new ApiError(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} is unavailable`,
      503
    );
  },
};

/**
 * Handle any error and return appropriate response
 */
export function handleError(error: unknown): NextResponse<ApiErrorResponse> {
  // Already an ApiError
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return Errors.validationError(error.flatten()).toResponse();
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": // Unique constraint violation
        return Errors.conflict("A record with this value already exists").toResponse();
      case "P2025": // Record not found
        return Errors.notFound().toResponse();
      case "P2003": // Foreign key constraint violation
        return new ApiError(
          ErrorCode.CONFLICT,
          "Cannot delete: resource is referenced by other records",
          409
        ).toResponse();
      default:
        console.error("Prisma error:", error.code, error.message);
        return new ApiError(
          ErrorCode.DATABASE_ERROR,
          "Database operation failed",
          500
        ).toResponse();
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return Errors.validationError("Invalid database query").toResponse();
  }

  // Generic Error
  if (error instanceof Error) {
    console.error("Unhandled error:", error.message, error.stack);
    return Errors.internal(
      process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    ).toResponse();
  }

  // Unknown error
  console.error("Unknown error:", error);
  return Errors.internal().toResponse();
}

/**
 * Create a success response
 */
export function success<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true as const, data }, { status });
}

/**
 * Wrapper for API route handlers with automatic error handling
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T>>> {
  return handler().catch(handleError);
}
