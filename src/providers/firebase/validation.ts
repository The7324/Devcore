import type { FirebaseServiceAccount } from "@/providers/firebase/types";

export interface FormatCheckResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_SA_FIELDS: (keyof FirebaseServiceAccount)[] = [
  "type",
  "project_id",
  "private_key",
  "private_key_id",
  "client_email",
  "client_id",
  "auth_uri",
  "token_uri",
];

export function checkCredentialFormat(credentials: Record<string, string>): FormatCheckResult {
  const errors: string[] = [];

  const rawJson = credentials["serviceAccountJson"] ?? "";
  if (!rawJson) {
    errors.push("Service Account JSON is required");
    return { valid: false, errors };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    errors.push("Service Account JSON is not valid JSON");
    return { valid: false, errors };
  }

  for (const field of REQUIRED_SA_FIELDS) {
    const val = parsed[field];
    if (!val || typeof val !== "string" || val.trim().length === 0) {
      errors.push(`Service Account JSON is missing required field: ${field}`);
    }
  }

  if (parsed["type"] !== "service_account") {
    errors.push(`Expected type "service_account", got "${parsed["type"] ?? "undefined"}"`);
  }

  const privateKey = parsed["private_key"] as string | undefined;
  if (privateKey && !privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    errors.push("private_key does not appear to be a valid PEM-encoded private key");
  }

  const projectId = credentials["projectId"] ?? credentials["project_id"] ?? "";
  if (!projectId) {
    errors.push("Project ID is required");
  }
  if (projectId && !/^[a-z][a-z0-9-]{3,29}$/.test(projectId)) {
    errors.push("Project ID must be 4-30 characters, start with a lowercase letter, and contain only lowercase letters, digits, and hyphens");
  }

  return { valid: errors.length === 0, errors };
}

export function getNormalizedCredentials(credentials: Record<string, string>): {
  projectId: string;
  serviceAccount: FirebaseServiceAccount;
  storageBucket?: string;
  appId?: string;
  region?: string;
} {
  const rawJson = credentials["serviceAccountJson"] ?? "";
  const serviceAccount = JSON.parse(rawJson) as FirebaseServiceAccount;
  const projectId = (credentials["projectId"] ?? credentials["project_id"] ?? serviceAccount.project_id).trim();

  return {
    projectId,
    serviceAccount,
    storageBucket: credentials["storageBucket"]?.trim() || undefined,
    appId: credentials["appId"]?.trim() || undefined,
    region: credentials["region"]?.trim() || undefined,
  };
}
