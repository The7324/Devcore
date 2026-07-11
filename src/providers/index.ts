import type { ProviderRegistry } from "@/connections/provider.registry";
import { Logger } from "@/core/logger/logger";
import { CloudflareProviderPlugin } from "@/providers/cloudflare/plugin";
import { FirebaseProviderPlugin } from "@/providers/firebase/plugin";
import { GitHubProviderPlugin } from "@/providers/github/plugin";

export function setupProviders(registry: ProviderRegistry, logger: Logger): void {
  registry.register(new CloudflareProviderPlugin(logger));
  registry.register(new FirebaseProviderPlugin(logger));
  registry.register(new GitHubProviderPlugin(logger));
  logger.info("Cloudflare provider registered");
  logger.info("Firebase provider registered");
  logger.info("GitHub provider registered");
}
