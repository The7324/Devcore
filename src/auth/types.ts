export enum Role {
  Owner = "OWNER",
  Admin = "ADMIN",
  ReadOnly = "READ_ONLY",
}

export const ALL_ROLES: readonly Role[] = [Role.Owner, Role.Admin, Role.ReadOnly];
export const ADMIN_ROLES: readonly Role[] = [Role.Owner, Role.Admin];

export const Permission = {
  AdminManage: "admin.manage",
  ProvidersManage: "providers.manage",
  ProvidersView: "providers.view",
  DatabaseManage: "database.manage",
  StorageManage: "storage.manage",
  LogsView: "logs.view",
  SettingsManage: "settings.manage",
  InfoView: "info.view",
  SearchExecute: "search.execute",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly string[] = Object.values(Permission);

export function isPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.includes(value);
}

export interface AuthUser {
  id: number;
  username: string | undefined;
  firstName: string;
  role: Role;
}

export interface Session {
  id: string;
  userId: number;
  role: Role;
  createdAt: number;
  expiresAt: number;
}

export interface AuthConfig {
  ownerId: number;
  adminIds: number[];
  encryptionKey?: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  sessionTtlMs: number;
}

export interface CheckResult {
  allowed: boolean;
  reason?: string;
}
