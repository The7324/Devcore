export interface CfCredentials {
  apiToken: string;
  accountId: string;
  email?: string;
}

export interface CfApiResponse<T> {
  success: boolean;
  errors: CfApiError[];
  messages: CfApiMessage[];
  result: T;
}

export interface CfApiError {
  code: number;
  message: string;
}

export interface CfApiMessage {
  code: number;
  message: string;
}

export interface TokenVerifyResult {
  id: string;
  name: string;
  status: string;
  permissions: Record<string, { read?: string; write?: string }>;
  resources?: Record<string, unknown>;
}

export interface AccountResult {
  id: string;
  name: string;
  type: string;
  created_on: string;
  settings?: Record<string, unknown>;
}

export interface UserResult {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
}

export type CfPermissionScope =
  | "dns" | "workers" | "r2" | "d1" | "kv" | "pages"
  | "cache" | "analytics" | "ssl" | "stream"
  | "emailRouting" | "health" | "ai" | "zeroTrust";

export const CF_PERMISSION_MAP: Record<string, CfPermissionScope> = {
  "com.cloudflare.api.account.zone.dns": "dns",
  "com.cloudflare.api.account.zone.cache": "cache",
  "com.cloudflare.api.account.zone.analytics": "analytics",
  "com.cloudflare.api.account.zone.ssl": "ssl",
  "com.cloudflare.api.account.zone.workers": "workers",
  "com.cloudflare.api.account.user.workers": "workers",
  "com.cloudflare.api.account.workers": "workers",
  "com.cloudflare.api.account.r2": "r2",
  "com.cloudflare.api.account.d1": "d1",
  "com.cloudflare.api.account.kv": "kv",
  "com.cloudflare.api.account.pages": "pages",
  "com.cloudflare.api.account.stream": "stream",
  "com.cloudflare.api.account.email_routing": "emailRouting",
  "com.cloudflare.api.account.health": "health",
  "com.cloudflare.api.account.ai": "ai",
  "com.cloudflare.api.account.zero_trust": "zeroTrust",
  "dns": "dns",
  "workers": "workers",
  "r2": "r2",
  "d1": "d1",
  "kv": "kv",
  "pages": "pages",
  "cache": "cache",
  "analytics": "analytics",
  "ssl": "ssl",
  "stream": "stream",
  "email_routing": "emailRouting",
  "health": "health",
  "ai": "ai",
  "zero_trust": "zeroTrust",
};

export interface CloudflareMetadata {
  accountName: string;
  accountId: string;
  accountType: string;
  accountCreatedOn: string;
  tokenName: string;
  tokenId: string;
  tokenStatus: string;
  permissions: CfPermissionScope[];
  email: string | null;
}

export interface ValidationProgress {
  step: string;
  status: "pending" | "running" | "passed" | "failed";
  message: string;
}
