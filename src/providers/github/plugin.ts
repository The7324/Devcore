import type { ProviderPlugin, HealthStatus, ProviderMeta } from "@/connections/types";
import { Logger } from "@/core/logger/logger";
import { GitHubClient, GitHubApiError } from "@/providers/github/client";
import { GitHubManager } from "@/providers/github/manager";
import { checkCredentialFormat, getNormalizedCredentials } from "@/providers/github/validation";
import type { GitHubMetadata } from "@/providers/github/types";

export class GitHubProviderPlugin implements ProviderPlugin {
  readonly meta: ProviderMeta = {
    name: "GitHub",
    version: "0.1.0",
    description: "GitHub API v3 — authentication, repository management, and capability detection",
    icon: "📦",
    color: "#2da44e",
    capabilities: [
      "repositories",
      "issues",
      "pull_requests",
      "actions",
      "packages",
      "releases",
      "codespaces",
      "projects",
      "security_alerts",
    ],
    credentialSchema: [
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        required: true,
        placeholder: "GitHub Personal Access Token (ghp_...)",
      },
      {
        key: "defaultOwner",
        label: "Default Owner (optional)",
        type: "text",
        required: false,
        placeholder: "Username or organization name",
      },
      {
        key: "defaultRepository",
        label: "Default Repository (optional)",
        type: "text",
        required: false,
        placeholder: "owner/repo",
      },
      {
        key: "preferredOrganization",
        label: "Preferred Organization (optional)",
        type: "text",
        required: false,
        placeholder: "Organization name",
      },
    ],
  };

  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async validate(credentials: Record<string, string>): Promise<{ valid: boolean; errors?: string[] }> {
    const format = checkCredentialFormat(credentials);
    if (!format.valid) return format;

    const norm = getNormalizedCredentials(credentials);
    const client = new GitHubClient(norm.accessToken, this.logger);

    try {
      this.logger.info("Validating GitHub credentials");
      const { user, scopes } = await client.checkToken();
      this.logger.info("GitHub validation successful", { username: user.login, scopes: scopes.length });
      return { valid: true };
    } catch (error) {
      this.logger.error("GitHub validation failed", error);
      const msg = this.extractErrorMessage(error);
      return { valid: false, errors: [msg] };
    }
  }

  async test(credentials: Record<string, string>): Promise<HealthStatus> {
    const norm = getNormalizedCredentials(credentials);
    const client = new GitHubClient(norm.accessToken, this.logger);
    try {
      const { healthy, latency } = await client.healthCheck();
      if (!healthy) return "error";
      return latency > 2000 ? "warning" : "healthy";
    } catch {
      return "error";
    }
  }

  async getMetadata(credentials: Record<string, string>): Promise<{ metadata: GitHubMetadata; latency: number }> {
    const norm = getNormalizedCredentials(credentials);
    const manager = new GitHubManager(norm.accessToken, this.logger);
    const start = Date.now();
    const metadata = await manager.getMetadata();
    const latency = Date.now() - start;
    return { metadata, latency };
  }

  createManager(credentials: Record<string, string>): GitHubManager {
    const norm = getNormalizedCredentials(credentials);
    return new GitHubManager(norm.accessToken, this.logger);
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof GitHubApiError) {
      if (error.status === 401) return "Invalid or expired token — generate a new one at GitHub Settings > Developer Settings";
      if (error.status === 403) return "Token lacks permission or rate limited — check token scopes";
      if (error.status === 404) return "Resource not found — check the repository or organization name";
      return `API error (${error.status}): ${error.message}`;
    }
    return error instanceof Error ? error.message : "Unexpected validation error";
  }
}
