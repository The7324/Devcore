import type { ProviderPlugin, HealthStatus, ProviderMeta } from "@/connections/types";
import { Logger } from "@/core/logger/logger";
import { FirebaseClient, FirebaseAuthError, FirebaseApiError } from "@/providers/firebase/client";
import { checkCredentialFormat, getNormalizedCredentials } from "@/providers/firebase/validation";
import { collectMetadata } from "@/providers/firebase/metadata";
import type { FirebaseMetadata } from "@/providers/firebase/types";

export class FirebaseProviderPlugin implements ProviderPlugin {
  readonly meta: ProviderMeta = {
    name: "Firebase",
    version: "0.1.0",
    description: "Google Firebase & Google Cloud Platform — authentication, project discovery, and service management",
    icon: "🔥",
    color: "#ffca28",
    capabilities: [
      "firestore",
      "realtime_database",
      "storage",
      "authentication",
      "cloud_messaging",
      "remote_config",
      "hosting",
      "cloud_functions",
      "app_check",
      "analytics",
    ],
    credentialSchema: [
      {
        key: "serviceAccountJson",
        label: "Service Account JSON",
        type: "json",
        required: true,
        placeholder: "Paste the entire service account JSON file content here…",
      },
      {
        key: "projectId",
        label: "Project ID",
        type: "text",
        required: true,
        placeholder: "my-firebase-project",
      },
      {
        key: "storageBucket",
        label: "Storage Bucket (optional)",
        type: "text",
        required: false,
        placeholder: "my-project.appspot.com",
      },
      {
        key: "appId",
        label: "App ID (optional)",
        type: "text",
        required: false,
        placeholder: "1:123456789:android:abc123",
      },
      {
        key: "region",
        label: "Region (optional)",
        type: "text",
        required: false,
        placeholder: "us-central1",
      },
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
    const client = new FirebaseClient(norm.serviceAccount, this.logger);

    try {
      this.logger.info("Validating Firebase credentials", { projectId: norm.projectId });

      const token = await client.getAccessToken();
      if (!token) {
        return { valid: false, errors: ["Failed to obtain access token from service account"] };
      }

      const project = await client.getProjectInfo(norm.projectId);
      if (!project || !project.projectId) {
        return { valid: false, errors: [`Project "${norm.projectId}" not found or not accessible`] };
      }

      this.logger.info("Firebase validation successful", {
        projectId: norm.projectId,
        projectNumber: project.projectNumber,
      });
      return { valid: true };
    } catch (error) {
      this.logger.error("Firebase validation failed", error);
      const msg = this.extractErrorMessage(error);
      return { valid: false, errors: [msg] };
    }
  }

  async test(credentials: Record<string, string>): Promise<HealthStatus> {
    const norm = getNormalizedCredentials(credentials);
    const client = new FirebaseClient(norm.serviceAccount, this.logger);

    try {
      this.logger.info("Testing Firebase connection health");
      const { healthy, latency } = await client.healthCheck();
      this.logger.debug("Firebase health check", { healthy, latency });
      if (!healthy) return "error";
      return latency > 3000 ? "warning" : "healthy";
    } catch (error) {
      this.logger.error("Firebase health check failed", error);
      return "error";
    }
  }

  async getMetadata(
    credentials: Record<string, string>,
  ): Promise<{ metadata: FirebaseMetadata; latency: number }> {
    const norm = getNormalizedCredentials(credentials);
    const client = new FirebaseClient(norm.serviceAccount, this.logger);
    const { metadata, latency } = await collectMetadata(client, norm.projectId);
    return { metadata, latency };
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof FirebaseAuthError) return error.message;
    if (error instanceof FirebaseApiError) {
      if (error.status === 403) return "Permission denied — the service account may not have access to this project";
      if (error.status === 404) return "Project not found — check the Project ID";
      if (error.status === 429) return "Rate limited — try again later";
      return `API error (${error.status}): ${error.message}`;
    }
    return error instanceof Error ? error.message : "Unexpected validation error";
  }
}
