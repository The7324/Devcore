import type { Container } from "@/core/di/container";
import type { MiddlewareStack } from "@/core/middleware/middleware";
import type { CommandRouter } from "@/core/router/command.router";
import type { Logger } from "@/core/logger/logger";

export interface PluginMeta {
  name: string;
  version: string;
  description: string;
}

export interface PluginManifest {
  meta: PluginMeta;
  /** List of other plugin names this plugin depends on */
  dependencies?: string[];
}

export interface PluginContext {
  container: Container;
  logger: Logger;
  router: CommandRouter;
  middleware: MiddlewareStack;
}

export interface Plugin {
  manifest: PluginManifest;

  init(context: PluginContext): Promise<void> | void;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}
