import type { StatusCode } from "hono/utils/http-status";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, unknown>;
  meta?: {
    timestamp: string;
  };
}

export function success<T>(data: T, statusCode: StatusCode = 200): { body: ApiResponse<T>; status: StatusCode } {
  return {
    body: {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    },
    status: statusCode,
  };
}

export function created<T>(data: T): { body: ApiResponse<T>; status: StatusCode } {
  return success(data, 201);
}

export function noContent(): { body: ApiResponse<never>; status: StatusCode } {
  return {
    body: { success: true, meta: { timestamp: new Date().toISOString() } },
    status: 204,
  };
}

export function telegramResponse(method: string, payload: Record<string, unknown>): { body: string; status: StatusCode } {
  return {
    body: JSON.stringify({ method, ...payload }),
    status: 200,
  };
}
