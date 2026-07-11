import { createApp } from "@/app";
import { setupTelegram } from "@/telegram";
import { setupAuth, type AuthConfig } from "@/auth";
import type { CloudflareBindings } from "@/types";

const appCtx = createApp();

function buildAuthConfig(env: CloudflareBindings): AuthConfig {
  return {
    ownerId: env.OWNER_ID,
    adminIds: typeof env.ADMIN_IDS === "string"
      ? env.ADMIN_IDS.split(",").map(Number).filter((n) => !Number.isNaN(n))
      : [],
    encryptionKey: env.ENCRYPTION_KEY,
    rateLimitMax: env.RATE_LIMIT_MAX ?? 30,
    rateLimitWindowMs: (env.RATE_LIMIT_WINDOW_SEC ?? 60) * 1000,
    sessionTtlMs: (env.SESSION_TTL_SEC ?? 3600) * 1000,
  };
}

export default {
  async fetch(request: Request, env: CloudflareBindings): Promise<Response> {
    appCtx.config.load(env as unknown as Record<string, unknown>);

    const authConfig = buildAuthConfig(env);
    const authLayer = setupAuth(authConfig, appCtx.logger);
    setupTelegram(appCtx.app, env.TELEGRAM_BOT_TOKEN, appCtx.logger, authLayer);

    if (env.ENVIRONMENT !== "production") {
      appCtx.logger.info("DevCore starting", { environment: env.ENVIRONMENT ?? "development" });
    }

    return appCtx.app.fetch(request, env);
  },
} satisfies ExportedHandler<CloudflareBindings>;
