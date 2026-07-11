import { CF_PERMISSION_MAP, type CfPermissionScope } from "@/providers/cloudflare/types";

export function detectPermissionScopes(
  permissions: Record<string, { read?: string; write?: string }>,
): CfPermissionScope[] {
  const scopes = new Set<CfPermissionScope>();

  for (const [key] of Object.entries(permissions)) {
    const mapped = CF_PERMISSION_MAP[key] ?? CF_PERMISSION_MAP[key.toLowerCase()];
    if (mapped) scopes.add(mapped);
  }

  const sorted = [...scopes].sort();
  return sorted;
}
