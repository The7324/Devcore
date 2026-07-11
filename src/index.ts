import { createApp } from "@/app";
import type { CloudflareBindings } from "@/types";

const appCtx = createApp();

export default {
  async fetch(request: Request, env: CloudflareBindings): Promise<Response> {
    appCtx.config.load(env as unknown as Record<string, unknown>);

    if (env.ENVIRONMENT !== "production") {
      const logger = appCtx.logger;
      logger.info("DevCore starting", { environment: env.ENVIRONMENT ?? "development" });
    }

    return appCtx.app.fetch(request, env);
  },
} satisfies ExportedHandler<CloudflareBindings>;
