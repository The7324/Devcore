import { Hono } from "hono";
import type { AppEnv } from "@/types";
import { Logger } from "@/core/logger/logger";
import { TelegramRouter } from "@/telegram/router";
import { createWebhookHandler } from "@/telegram/webhook";
import { startCommand } from "@/commands/start";
import { helpCommand } from "@/commands/help";
import { pingCommand } from "@/commands/ping";

export { TelegramContext } from "@/telegram/context";
export { TelegramRouter } from "@/telegram/router";
export { TelegramSender } from "@/telegram/sender";
export { createWebhookHandler, setWebhookUrl, deleteWebhookUrl } from "@/telegram/webhook";
export { parseUpdate } from "@/telegram/update.parser";
export { TelegramError, TelegramApiCallError } from "@/telegram/errors";
export * as replyHelpers from "@/telegram/reply";
export * as buttons from "@/telegram/buttons";
export type * from "@/telegram/types";

let telegramInitialized = false;

export function setupTelegram(app: Hono<AppEnv>, botToken: string, logger: Logger): void {
  if (telegramInitialized) return;
  telegramInitialized = true;

  const router = new TelegramRouter(logger);

  router.register(startCommand);
  router.register(helpCommand);
  router.register(pingCommand);

  app.post("/webhook", createWebhookHandler(router, botToken, logger));

  logger.info("Telegram module initialized", {
    commands: router.registeredCommands.map((c) => c.meta.name),
  });
}
