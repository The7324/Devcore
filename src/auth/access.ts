import { type AuthUser, type CheckResult } from "@/auth/types";
import { roleHasAllPermissions, roleHasAnyPermission } from "@/auth/roles";
import { isPermission, type Permission as PermissionType } from "@/auth/types";

function toPermissions(perms: string[]): PermissionType[] {
  return perms.filter((p): p is PermissionType => isPermission(p));
}

export class AccessControl {
  canAccess(user: AuthUser, requiredPermissions?: string[]): CheckResult {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return { allowed: true };
    }

    const resolved = toPermissions(requiredPermissions);
    if (resolved.length === 0) return { allowed: true };

    if (roleHasAllPermissions(user.role, resolved)) {
      return { allowed: true };
    }

    const missing = resolved.filter(
      (p) => !roleHasAnyPermission(user.role, [p]),
    );

    return {
      allowed: false,
      reason: `You lack the required permissions: ${missing.join(", ")}.`,
    };
  }

  canAccessAny(user: AuthUser, permissions: string[]): CheckResult {
    if (permissions.length === 0) return { allowed: true };

    const resolved = toPermissions(permissions);
    if (resolved.length === 0) return { allowed: true };

    if (roleHasAnyPermission(user.role, resolved)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "You do not have permission to perform this action.",
    };
  }
}
