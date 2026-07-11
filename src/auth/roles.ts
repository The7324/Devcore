import { Role, Permission, ALL_PERMISSIONS, type Permission as PermissionType } from "@/auth/types";

const OWNER_PERMISSIONS: Set<PermissionType> = new Set(ALL_PERMISSIONS as PermissionType[]);

const ADMIN_PERMISSIONS: Set<PermissionType> = new Set([
  Permission.ProvidersManage,
  Permission.DatabaseManage,
  Permission.StorageManage,
  Permission.LogsView,
  Permission.InfoView,
  Permission.SearchExecute,
]);

const READ_ONLY_PERMISSIONS: Set<PermissionType> = new Set([
  Permission.InfoView,
  Permission.SearchExecute,
]);

const ROLE_PERMISSIONS: Record<Role, Set<PermissionType>> = {
  [Role.Owner]: OWNER_PERMISSIONS,
  [Role.Admin]: ADMIN_PERMISSIONS,
  [Role.ReadOnly]: READ_ONLY_PERMISSIONS,
};

export function roleHasPermission(role: Role, permission: PermissionType): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function roleHasAnyPermission(role: Role, permissions: PermissionType[]): boolean {
  return permissions.some((p) => roleHasPermission(role, p));
}

export function roleHasAllPermissions(role: Role, permissions: PermissionType[]): boolean {
  return permissions.every((p) => roleHasPermission(role, p));
}

export function getRolePermissions(role: Role): PermissionType[] {
  const set = ROLE_PERMISSIONS[role];
  return set ? [...set] : [];
}
