import { Logger } from "@/core/logger/logger";
import type { CfApiResponse } from "@/providers/cloudflare/types";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CfClientOptions {
  apiToken: string;
  email?: string;
  logger?: Logger;
}

export class CloudflareClient {
  readonly baseUrl = CF_API_BASE;
  readonly token: string;
  private readonly email: string | undefined;
  private readonly logger: Logger | undefined;

  constructor(options: CfClientOptions) {
    this.token = options.apiToken;
    this.email = options.email;
    this.logger = options.logger;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
    if (this.email) h["X-Auth-Email"] = this.email;
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<{ data: CfApiResponse<T>; latency: number }> {
    const url = `${this.baseUrl}${path}`;
    const start = Date.now();
    this.logger?.debug(`CF API ${method} ${path}`);

    const headers = { ...this.headers(), ...extraHeaders };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const latency = Date.now() - start;

    if (response.status === 429) {
      this.logger?.warn("CF API rate limited", { path });
      throw new CfRateLimitError();
    }

    if (!response.ok && method !== "DELETE") {
      const errBody = await response.json().catch(() => ({}));
      const errors = (errBody as CfApiResponse<unknown>).errors ?? [];
      this.logger?.error(`CF API error ${response.status}`, undefined, {
        path, status: response.status, errors,
      });
      throw CfApiError.fromResponse(response.status, errors);
    }

    if (method === "DELETE" && !response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errors = (errBody as CfApiResponse<unknown>).errors ?? [];
      throw CfApiError.fromResponse(response.status, errors);
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) as CfApiResponse<T> : { success: true, errors: [], messages: [], result: null as T };
    this.logger?.debug(`CF API ${method} ${path} OK`, { latency, success: data.success });

    if (!data.success && data.errors?.length) {
      throw CfApiError.fromResponse(response.status, data.errors);
    }

    return { data, latency };
  }

  async get<T>(path: string): Promise<{ data: CfApiResponse<T>; latency: number }> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<{ data: CfApiResponse<T>; latency: number }> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<{ data: CfApiResponse<T>; latency: number }> {
    return this.request<T>("PATCH", path, body);
  }

  async put<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<{ data: CfApiResponse<T>; latency: number }> {
    return this.request<T>("PUT", path, body, extraHeaders);
  }

  async delete<T = void>(path: string): Promise<{ data: CfApiResponse<T>; latency: number }> {
    return this.request<T>("DELETE", path);
  }
}

export class CfRateLimitError extends Error {
  constructor() {
    super("Cloudflare API rate limit exceeded");
    this.name = "CfRateLimitError";
  }
}

export class CfApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly cfCode?: number,
  ) {
    super(message);
    this.name = "CfApiError";
  }

  static fromResponse(status: number, errors: { code?: number; message?: string }[]): CfApiError {
    const msg = errors.map((e) => e.message ?? "Unknown error").join("; ");
    return new CfApiError(msg || `HTTP ${status}`, status, errors[0]?.code);
  }
}
