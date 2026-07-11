import type { ProviderPlugin, HealthStatus, ProviderMeta } from "@/connections/types";
import { Logger } from "@/core/logger/logger";
import { CloudflareClient, CfApiError } from "@/providers/cloudflare/client";
import { checkCredentialFormat, getNormalizedCredentials } from "@/providers/cloudflare/validation";
import { collectMetadata } from "@/providers/cloudflare/metadata";
import type { CloudflareMetadata } from "@/providers/cloudflare/types";
import { ResourceApi } from "@/providers/cloudflare/resources";

export class CloudflareProviderPlugin implements ProviderPlugin {
  readonly meta: ProviderMeta = {
    name: "Cloudflare",
    version: "0.1.0",
    description: "Cloudflare API v4 — manage DNS, Workers, R2, D1, KV, Pages, Cache & more",
    icon: "☁️",
    color: "#f38020",
    capabilities: [
      "dns", "workers", "r2", "d1", "kv", "pages",
      "cache", "analytics", "ssl", "stream", "ai",
      "zeroTrust", "emailRouting",
    ],
    credentialSchema: [
      { key: "apiToken", label: "API Token", type: "password", required: true, placeholder: "Cloudflare API Token (v4)" },
      { key: "accountId", label: "Account ID", type: "text", required: true, placeholder: "32-character hex account ID" },
      { key: "email", label: "Email (optional)", type: "text", required: false, placeholder: "Account email for legacy auth" },
    ],
  };

  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async validate(
    credentials: Record<string, string>,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const format = checkCredentialFormat(credentials);
    if (!format.valid) return format;

    const norm = getNormalizedCredentials(credentials);
    const client = new CloudflareClient({ apiToken: norm.apiToken, email: norm.email, logger: this.logger });

    try {
      this.logger.info("Validating Cloudflare credentials", { accountId: norm.accountId });
      await client.get("/user/tokens/verify");

      const verifyAccount = await client.get("/accounts");
      const accounts = verifyAccount.data.result as Array<{ id: string }>;
      const found = accounts?.some((a) => a.id === norm.accountId);
      if (!found) {
        return { valid: false, errors: [`Account ID ${norm.accountId} not found or not accessible with this token`] };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error("Cloudflare validation failed", error);
      const msg = error instanceof CfApiError ? error.message : "Validation failed unexpectedly";
      return { valid: false, errors: [msg] };
    }
  }

  async test(credentials: Record<string, string>): Promise<HealthStatus> {
    const norm = getNormalizedCredentials(credentials);
    const client = new CloudflareClient({ apiToken: norm.apiToken, email: norm.email, logger: this.logger });

    try {
      this.logger.info("Testing Cloudflare connection health");
      const { latency } = await client.get("/user/tokens/verify");
      this.logger.debug("Cloudflare health check OK", { latency });
      return latency > 2000 ? "warning" : "healthy";
    } catch (error) {
      this.logger.error("Cloudflare health check failed", error);
      return "error";
    }
  }

  async getMetadata(credentials: Record<string, string>): Promise<{ metadata: CloudflareMetadata; latency: number }> {
    const norm = getNormalizedCredentials(credentials);
    const client = new CloudflareClient({ apiToken: norm.apiToken, email: norm.email, logger: this.logger });
    return collectMetadata(client);
  }

  createResourceApi(credentials: Record<string, string>): ResourceApi {
    const norm = getNormalizedCredentials(credentials);
    const client = new CloudflareClient({ apiToken: norm.apiToken, email: norm.email, logger: this.logger });
    return new ResourceApi(client, norm.accountId);
  }
}
