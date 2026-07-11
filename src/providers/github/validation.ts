import type { GitHubCredentials } from "@/providers/github/types";

export interface FormatCheckResult {
  valid: boolean;
  errors: string[];
}

export function checkCredentialFormat(credentials: Record<string, string>): FormatCheckResult {
  const errors: string[] = [];

  const token = credentials["accessToken"] ?? credentials["token"] ?? "";
  if (!token) {
    errors.push("Access token is required");
    return { valid: false, errors };
  }

  if (token.length < 10) {
    errors.push("Access token appears too short");
  }

  if (token.startsWith("ghp_") || token.startsWith("gho_") || token.startsWith("ghu_") || token.startsWith("ghs_") || token.startsWith("ghr_")) {
    // valid GitHub token format
  } else if (/^[a-f0-9]{40}$/.test(token)) {
    // SHA1 format (old)
  } else {
    errors.push("Access token does not match GitHub token format (ghp_*, gho_*, ghs_*, ghr_*, or 40-char hex)");
  }

  return { valid: errors.length === 0, errors };
}

export function getNormalizedCredentials(credentials: Record<string, string>): GitHubCredentials {
  return {
    accessToken: (credentials["accessToken"] ?? credentials["token"] ?? "").trim(),
    defaultOwner: credentials["defaultOwner"]?.trim() || undefined,
    defaultRepository: credentials["defaultRepository"]?.trim() || undefined,
    preferredOrganization: credentials["preferredOrganization"]?.trim() || undefined,
  };
}
