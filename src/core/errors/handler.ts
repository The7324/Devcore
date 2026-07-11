import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { Logger } from "@/core/logger/logger";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: StatusCode = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: Record<string, unknown>) {
    super(message, 400, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export function handleError(error: unknown, logger: Logger): Response {
  if (error instanceof AppError) {
    logger.warn(`AppError: ${error.message}`, {
      statusCode: error.statusCode,
      details: error.details,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        ...(error.details && { details: error.details }),
      }),
      { status: error.statusCode, headers: { "Content-Type": "application/json" } },
    );
  }

  if (error instanceof HTTPException) {
    logger.warn(`HTTPException: ${error.message}`, { statusCode: error.status });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: error.status, headers: { "Content-Type": "application/json" } },
    );
  }

  logger.error("Unhandled error", error);
  return new Response(
    JSON.stringify({ success: false, error: "Internal server error" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
}

export function errorHandlerMiddleware(logger: Logger) {
  return async (_c: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      return handleError(error, logger);
    }
  };
}
