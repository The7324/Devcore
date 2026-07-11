import { validateEnv, type Env } from "@/core/validator/env.validator";

export class ConfigManager {
  private env: Env | null = null;

  load(bindings: Record<string, unknown>): Env {
    this.env = validateEnv(bindings);
    return this.env;
  }

  get<T = string>(key: keyof Env): T {
    if (!this.env) {
      throw new Error("ConfigManager has not been loaded. Call load() first.");
    }
    return this.env[key] as T;
  }

  all(): Env {
    if (!this.env) {
      throw new Error("ConfigManager has not been loaded. Call load() first.");
    }
    return { ...this.env };
  }
}
