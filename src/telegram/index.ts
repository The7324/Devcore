import { Hono } from "hono";
import type { AppEnv } from "@/types";
import { Logger } from "@/core/logger/logger";
import { TelegramRouter } from "@/telegram/router";
import { createWebhookHandler } from "@/telegram/webhook";
import { startCommand } from "@/commands/start";
import { helpCommand } from "@/commands/help";
import { pingCommand } from "@/commands/ping";
import { createConnectionsCommand } from "@/commands/connections";
import { createCloudflareCommand } from "@/commands/cloudflare";
import { createR2Command } from "@/commands/r2";
import type { AuthLayer } from "@/auth";
import type { ConnectionsLayer } from "@/connections";

export { TelegramContext } from "@/telegram/context";
export { TelegramRouter } from "@/telegram/router";
export { TelegramSender } from "@/telegram/sender";
export { createWebhookHandler, setWebhookUrl, deleteWebhookUrl } from "@/telegram/webhook";
export { parseUpdate } from "@/telegram/update.parser";
export { TelegramError, TelegramApiCallError } from "@/telegram/errors";
export * as replyHelpers from "@/telegram/reply";
export * as buttons from "@/telegram/buttons";
export type * from "@/telegram/types";

let initDone = false;

export function setupTelegram(
  app: Hono<AppEnv>,
  botToken: string,
  logger: Logger,
  authLayer?: AuthLayer,
  connectionsLayer?: ConnectionsLayer,
): TelegramRouter {
  if (initDone) throw new Error("Telegram module is already initialized");
  initDone = true;

  const router = new TelegramRouter(logger);

  if (authLayer) {
    for (const mw of authLayer.middlewares) {
      router.use(mw);
    }
    logger.info("Auth middlewares attached to Telegram router");
  }

  router.register(startCommand);
  router.register(helpCommand);
  router.register(pingCommand);

  if (connectionsLayer) {
    router.register(createConnectionsCommand(connectionsLayer));
    router.register(createCloudflareCommand(connectionsLayer));
    router.register(createR2Command(connectionsLayer, router));
    logger.info("Connection commands registered");
  }

  app.post("/webhook", createWebhookHandler(router, botToken, logger));

  logger.info("Telegram module initialized", {
    commands: router.registeredCommands.map((c) => c.meta.name),
    authEnabled: !!authLayer,
    connectionsEnabled: !!connectionsLayer,
  });

  return router;
}
