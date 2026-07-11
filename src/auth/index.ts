import type { AuthConfig } from "@/auth/types";
import { UserStore } from "@/auth/user-store";
import { SessionManager } from "@/auth/session";
import { RateLimiter } from "@/auth/rate-limit";
import { AccessControl } from "@/auth/access";
import { AuditLogger } from "@/auth/audit";
import {
  AuthenticationMiddleware,
  AuthorizationMiddleware,
  RateLimitMiddleware,
  AuditMiddleware,
  type TelegramMiddleware,
} from "@/auth/middleware";
import type { Logger } from "@/core/logger/logger";

export { UserStore } from "@/auth/user-store";
export { SessionManager } from "@/auth/session";
export { RateLimiter } from "@/auth/rate-limit";
export { AccessControl } from "@/auth/access";
export { AuditLogger } from "@/auth/audit";
export { generateKey, deriveEncryptionKey, encrypt, decrypt, hash, verifyHash } from "@/auth/encrypt";
export { roleHasPermission, roleHasAnyPermission, roleHasAllPermissions, getRolePermissions } from "@/auth/roles";
export { Role, Permission, ALL_ROLES, ADMIN_ROLES, ALL_PERMISSIONS } from "@/auth/types";
export type { AuthUser, Session, AuthConfig, CheckResult, Permission as PermissionType } from "@/auth/types";
export {
  AuthenticationMiddleware,
  AuthorizationMiddleware,
  RateLimitMiddleware,
  AuditMiddleware,
};
export type { TelegramMiddleware };

export interface AuthLayer {
  userStore: UserStore;
  sessionManager: SessionManager;
  rateLimiter: RateLimiter;
  access: AccessControl;
  audit: AuditLogger;
  middlewares: TelegramMiddleware[];
}

let authInitialized = false;

export function setupAuth(config: AuthConfig, logger: Logger): AuthLayer {
  if (authInitialized) {
    throw new Error("Auth layer is already initialized");
  }
  authInitialized = true;

  const userStore = new UserStore(config.ownerId, config.adminIds);
  const sessionManager = new SessionManager(config.sessionTtlMs);
  const rateLimiter = new RateLimiter(config.rateLimitMax, config.rateLimitWindowMs);
  const access = new AccessControl();
  const audit = new AuditLogger(logger);

  const authMiddleware = new AuthenticationMiddleware(userStore, logger);
  const authorizationMiddleware = new AuthorizationMiddleware(userStore, access);
  const rateLimitMiddleware = new RateLimitMiddleware(rateLimiter, logger);
  const auditMiddleware = new AuditMiddleware(audit);

  const middlewares: TelegramMiddleware[] = [
    authMiddleware,
    authorizationMiddleware,
    rateLimitMiddleware,
    auditMiddleware,
  ];

  logger.info("Auth layer initialized", {
    ownerId: config.ownerId,
    adminCount: config.adminIds.length,
    rateLimitMax: config.rateLimitMax,
    rateLimitWindowMs: config.rateLimitWindowMs,
  });

  return { userStore, sessionManager, rateLimiter, access, audit, middlewares };
}
