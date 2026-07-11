import type { TelegramContext } from "@/telegram/context";
import type { TelegramCommand } from "@/telegram/types";
import type { Logger } from "@/core/logger/logger";
import { UserStore } from "@/auth/user-store";
import { RateLimiter } from "@/auth/rate-limit";
import { AccessControl } from "@/auth/access";
import { AuditLogger } from "@/auth/audit";
import type { CheckResult } from "@/auth/types";

export interface TelegramMiddleware {
  check(ctx: TelegramContext, command: TelegramCommand): Promise<CheckResult>;
  name: string;
}

export class AuthenticationMiddleware implements TelegramMiddleware {
  readonly name = "auth";

  constructor(
    private readonly userStore: UserStore,
    private readonly logger: Logger,
  ) {}

  async check(ctx: TelegramContext, _command: TelegramCommand): Promise<CheckResult> {
    const userId = ctx.user?.id;
    if (!userId) {
      return { allowed: false, reason: "Could not identify your Telegram account." };
    }

    const user = this.userStore.getUser(userId);
    if (!user) {
      this.logger.warn(`Unauthorized access attempt by user ${userId}`, {
        username: ctx.user?.username,
      });
      return { allowed: false, reason: "You are not authorized to use this bot." };
    }

    return { allowed: true };
  }
}

export class AuthorizationMiddleware implements TelegramMiddleware {
  readonly name = "authorization";

  constructor(
    private readonly userStore: UserStore,
    private readonly access: AccessControl,
  ) {}

  async check(ctx: TelegramContext, command: TelegramCommand): Promise<CheckResult> {
    const userId = ctx.user?.id;
    if (!userId) return { allowed: false, reason: "Could not identify your Telegram account." };

    const user = this.userStore.getUser(userId);
    if (!user) return { allowed: false, reason: "You are not authorized to use this bot." };

    return this.access.canAccess(user, command.permissions);
  }
}

export class RateLimitMiddleware implements TelegramMiddleware {
  readonly name = "rate-limit";

  constructor(
    private readonly rateLimiter: RateLimiter,
    private readonly logger: Logger,
  ) {}

  async check(ctx: TelegramContext, _command: TelegramCommand): Promise<CheckResult> {
    const userId = ctx.user?.id;
    if (!userId) return { allowed: true };

    const result = this.rateLimiter.check(userId);
    if (!result.allowed) {
      this.logger.warn(`Rate limit hit for user ${userId}`, {
        retryAfterMs: result.retryAfterMs,
      });
      return {
        allowed: false,
        reason: "You are being rate-limited. Please slow down.",
      };
    }

    return { allowed: true };
  }
}

export class AuditMiddleware implements TelegramMiddleware {
  readonly name = "audit";

  constructor(private readonly audit: AuditLogger) {}

  async check(_ctx: TelegramContext, _command: TelegramCommand): Promise<CheckResult> {
    return { allowed: true };
  }

  logSuccess(ctx: TelegramContext, command: TelegramCommand, elapsedMs: number): void {
    this.audit.logCommand(ctx, command, { allowed: true }, elapsedMs);
  }

  logDenied(ctx: TelegramContext, command: TelegramCommand, result: CheckResult, elapsedMs: number): void {
    this.audit.logCommand(ctx, command, result, elapsedMs);
    this.audit.logSecurityEvent(ctx.user?.id, "command-denied", {
      command: command.meta.name,
      reason: result.reason,
    });
  }

  logCallback(ctx: TelegramContext, data: string, result: CheckResult, elapsedMs: number): void {
    this.audit.logCallback(ctx, data, result, elapsedMs);
  }
}
