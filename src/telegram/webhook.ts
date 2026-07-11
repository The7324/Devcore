import type { Context } from "hono";
import { Logger } from "@/core/logger/logger";
import { parseUpdate } from "@/telegram/update.parser";
import { TelegramRouter } from "@/telegram/router";

export function createWebhookHandler(router: TelegramRouter, botToken: string, logger: Logger) {
  return async (c: Context): Promise<Response> => {
    if (c.req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return new Response("Unsupported media type", { status: 415 });
    }

    const body = await c.req.raw.clone().json().catch(() => null);
    if (!body) {
      logger.warn("Webhook: invalid JSON body");
      return new Response("Bad request", { status: 400 });
    }

    const update = parseUpdate(body);
    if (!update) {
      logger.warn("Webhook: malformed update", { body });
      return new Response("Bad request", { status: 400 });
    }

    c.executionCtx.waitUntil(
      (async () => {
        try {
          await router.dispatch(update, botToken);
        } catch (error) {
          logger.error("Webhook dispatch failed", error, { updateId: update.update_id });
        }
      })(),
    );

    return new Response("OK", { status: 200 });
  };
}

export function setWebhookUrl(token: string, url: string): Promise<Response> {
  const apiUrl = `https://api.telegram.org/bot${token}/setWebhook`;
  return fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, allowed_updates: ["message", "callback_query"] }),
  });
}

export function deleteWebhookUrl(token: string): Promise<Response> {
  const apiUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;
  return fetch(apiUrl, { method: "POST" });
}
