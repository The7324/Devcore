import type { Context } from "hono";
import { Logger } from "@/core/logger/logger";
import { HEALTH_PATH } from "@/constants";

export function requestLogger(logger: Logger) {
  return async (c: Context, next: () => Promise<void>) => {
    const start = Date.now();
    logger.info(`${c.req.method} ${c.req.url}`);
    await next();
    const ms = Date.now() - start;
    logger.debug(`Completed in ${ms}ms`, { method: c.req.method, url: c.req.url, status: c.res.status });
  };
}

export function parseTelegramUpdate(c: Context, next: () => Promise<void>) {
  if (c.req.path === HEALTH_PATH) return next();
  return next();
}

export function corsHeaders() {
  return async (c: Context, next: () => Promise<void>) => {
    c.res.headers.set("Access-Control-Allow-Origin", "*");
    c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    if (c.req.method === "OPTIONS") {
      c.res = new Response(null, { status: 204 });
      return;
    }
    await next();
  };
}
