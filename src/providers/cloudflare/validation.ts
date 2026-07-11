const ACCOUNT_ID_RE = /^[0-9a-f]{32}$/;
const TOKEN_MIN_LENGTH = 40;

export interface FormatCheckResult {
  valid: boolean;
  errors: string[];
}

export function checkCredentialFormat(credentials: Record<string, string>): FormatCheckResult {
  const errors: string[] = [];

  const apiToken = credentials["apiToken"] ?? credentials["api_token"] ?? "";
  const accountId = credentials["accountId"] ?? credentials["account_id"] ?? "";

  if (!apiToken) {
    errors.push("API Token is required");
  } else if (apiToken.length < TOKEN_MIN_LENGTH) {
    errors.push(`API Token must be at least ${TOKEN_MIN_LENGTH} characters`);
  }

  if (!accountId) {
    errors.push("Account ID is required");
  } else if (!ACCOUNT_ID_RE.test(accountId)) {
    errors.push("Account ID must be a 32-character hexadecimal string");
  }

  return { valid: errors.length === 0, errors };
}

export function getNormalizedCredentials(credentials: Record<string, string>): {
  apiToken: string;
  accountId: string;
  email: string | undefined;
} {
  return {
    apiToken: (credentials["apiToken"] ?? credentials["api_token"] ?? "").trim(),
    accountId: (credentials["accountId"] ?? credentials["account_id"] ?? "").trim().toLowerCase(),
    email: (credentials["email"] ?? "").trim() || undefined,
  };
}
