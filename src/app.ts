import { Hono } from "hono";
import type { AppEnv } from "@/types";
import { container } from "@/core/di/container";
import { Logger, LogLevel } from "@/core/logger/logger";
import { ConfigManager } from "@/core/config/manager";
import { CommandRouter } from "@/core/router/command.router";
import { PluginLoader } from "@/core/plugin/loader";
import { MiddlewareStack } from "@/core/middleware/middleware";
import { errorHandlerMiddleware } from "@/core/errors/handler";
import { requestLogger, corsHeaders } from "@/middleware";
import { HEALTH_PATH } from "@/constants";

export interface AppContext {
  container: typeof container;
  logger: Logger;
  config: ConfigManager;
  router: CommandRouter;
  plugins: PluginLoader;
  middleware: MiddlewareStack;
  app: Hono<AppEnv>;
}

export function createApp(): AppContext {
  const logger = new Logger({ minLevel: LogLevel.Debug });
  const config = new ConfigManager();
  const router = new CommandRouter(logger);
  const plugins = new PluginLoader(logger);
  const mw = new MiddlewareStack();
  const app = new Hono<AppEnv>();

  app.use(errorHandlerMiddleware(logger));
  app.use(requestLogger(logger));
  app.use(corsHeaders());

  app.get(HEALTH_PATH, (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

  return { container, logger, config, router, plugins, middleware: mw, app };
}
