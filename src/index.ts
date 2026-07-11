import { createApp } from "@/app";
import { setupTelegram } from "@/telegram";
import { setupAuth, type AuthConfig } from "@/auth";
import { setupConnections } from "@/connections";
import { setupProviders } from "@/providers";
import type { CloudflareBindings } from "@/types";

const appCtx = createApp();
let initPromise: Promise<void> | null = null;

function buildAuthConfig(env: CloudflareBindings): AuthConfig {
  return {
    ownerId: Number(env.OWNER_ID),
    adminIds: typeof env.ADMIN_IDS === "string"
      ? env.ADMIN_IDS.split(",").map(Number).filter((n) => !Number.isNaN(n))
      : [],
    encryptionKey: env.ENCRYPTION_KEY,
    rateLimitMax: env.RATE_LIMIT_MAX ?? 30,
    rateLimitWindowMs: (env.RATE_LIMIT_WINDOW_SEC ?? 60) * 1000,
    sessionTtlMs: (env.SESSION_TTL_SEC ?? 3600) * 1000,
  };
}

async function initialize(env: CloudflareBindings): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      appCtx.config.load(env as unknown as Record<string, unknown>);
      const authConfig = buildAuthConfig(env);
      const authLayer = setupAuth(authConfig, appCtx.logger);
      const connectionsLayer = await setupConnections(env.ENCRYPTION_KEY, appCtx.logger);
      setupProviders(connectionsLayer.providerRegistry, appCtx.logger);
      setupTelegram(appCtx.app, env.TELEGRAM_BOT_TOKEN, appCtx.logger, authLayer, connectionsLayer);
      if (env.ENVIRONMENT !== "production") {
        appCtx.logger.info("DevCore starting", { environment: env.ENVIRONMENT ?? "development" });
      }
    })();
  }
  await initPromise;
}

export default {
  async fetch(request: Request, env: CloudflareBindings, ctx: ExecutionContext): Promise<Response> {
    try {
      await initialize(env);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Init failed", detail: String(err) }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    return appCtx.app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareBindings>;
