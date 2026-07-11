import { createApp } from "@/app";
import { setupTelegram } from "@/telegram";
import type { CloudflareBindings } from "@/types";

const appCtx = createApp();

export default {
  async fetch(request: Request, env: CloudflareBindings): Promise<Response> {
    appCtx.config.load(env as unknown as Record<string, unknown>);
    setupTelegram(appCtx.app, env.TELEGRAM_BOT_TOKEN, appCtx.logger);

    if (env.ENVIRONMENT !== "production") {
      appCtx.logger.info("DevCore starting", { environment: env.ENVIRONMENT ?? "development" });
    }

    return appCtx.app.fetch(request, env);
  },
} satisfies ExportedHandler<CloudflareBindings>;
