import { Logger } from "@/core/logger/logger";
import type { CfApiResponse } from "@/providers/cloudflare/types";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CfClientOptions {
  apiToken: string;
  email?: string;
  logger?: Logger;
}

export class CloudflareClient {
  private readonly baseUrl = CF_API_BASE;
  private readonly token: string;
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

  async get<T>(path: string): Promise<{ data: CfApiResponse<T>; latency: number }> {
    const url = `${this.baseUrl}${path}`;
    const start = Date.now();
    this.logger?.debug(`CF API GET ${path}`);

    const response = await fetch(url, { method: "GET", headers: this.headers() });
    const latency = Date.now() - start;

    if (response.status === 429) {
      this.logger?.warn("CF API rate limited", { path });
      throw new CfRateLimitError();
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const errors = (body as CfApiResponse<unknown>).errors ?? [];
      this.logger?.error(`CF API error ${response.status}`, undefined, {
        path, status: response.status, errors,
      });
      throw CfApiError.fromResponse(response.status, errors);
    }

    const data = await response.json() as CfApiResponse<T>;
    this.logger?.debug(`CF API GET ${path} OK`, { latency, success: data.success });

    if (!data.success && data.errors?.length) {
      throw CfApiError.fromResponse(response.status, data.errors);
    }

    return { data, latency };
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
