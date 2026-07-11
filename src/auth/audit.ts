import type { Logger } from "@/core/logger/logger";
import type { TelegramContext } from "@/telegram/context";
import type { TelegramCommand } from "@/telegram/types";
import type { CheckResult } from "@/auth/types";

export class AuditLogger {
  constructor(private readonly logger: Logger) {}

  logCommand(ctx: TelegramContext, command: TelegramCommand, result: CheckResult, elapsedMs: number): void {
    this.logger.info("Command execution", {
      userId: ctx.user?.id,
      username: ctx.user?.username,
      command: command.meta.name,
      args: ctx.commandArgs,
      allowed: result.allowed,
      reason: result.reason,
      elapsedMs,
    });
  }

  logCallback(ctx: TelegramContext, data: string, result: CheckResult, elapsedMs: number): void {
    this.logger.info("Callback execution", {
      userId: ctx.user?.id,
      username: ctx.user?.username,
      callbackData: data,
      allowed: result.allowed,
      reason: result.reason,
      elapsedMs,
    });
  }

  logAuthEvent(userId: number, username: string | undefined, event: string, details?: Record<string, unknown>): void {
    this.logger.info(`Auth: ${event}`, {
      userId,
      username,
      event,
      ...details,
    });
  }

  logSecurityEvent(userId: number | undefined, event: string, details?: Record<string, unknown>): void {
    this.logger.warn(`Security: ${event}`, {
      userId,
      event,
      ...details,
    });
  }
}
