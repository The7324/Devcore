import { z } from "zod";

export const envSchema = z.object({
  ENVIRONMENT: z.enum(["development", "production", "staging"]).default("development"),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  OWNER_ID: z.coerce.number().int().positive("OWNER_ID must be a positive integer"),
  ADMIN_IDS: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  SESSION_TTL_SEC: z.coerce.number().int().positive().default(3600),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(input: Record<string, unknown>): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`,
    );
    throw new Error(`Environment validation failed:\n${issues.join("\n")}`);
  }
  return result.data;
}
