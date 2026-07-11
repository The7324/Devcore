import type { ProviderRegistry } from "@/connections/provider.registry";
import { Logger } from "@/core/logger/logger";
import { CloudflareProviderPlugin } from "@/providers/cloudflare/plugin";

export function setupProviders(registry: ProviderRegistry, logger: Logger): void {
  registry.register(new CloudflareProviderPlugin(logger));
  logger.info("Cloudflare provider registered");
}
