export type ConnectionStatus = "active" | "inactive" | "error";
export type HealthStatus = "healthy" | "warning" | "error" | "unknown";
export type ConnectionAction =
  | "created" | "deleted" | "modified"
  | "validated" | "activated" | "deactivated"
  | "error" | "credential_update" | "health_check";

export interface Connection {
  id: string;
  provider: string;
  name: string;
  description: string;
  encryptedCredentials: string;
  status: ConnectionStatus;
  health: HealthStatus;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt: string | null;
  lastUsedAt: string | null;
  ownerId: number;
  tags: string[];
  environment: string;
  region: string;
  color: string;
  icon: string;
  version: number;
  metadata: Record<string, string>;
}

export interface ConnectionGroup {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface ActiveConnection {
  userId: number;
  connectionId: string;
  activatedAt: string;
}

export interface ConnectionLog {
  id: string;
  connectionId: string;
  userId: number;
  action: ConnectionAction;
  details: Record<string, unknown>;
  timestamp: string;
  success: boolean;
}

export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "json";
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export interface ProviderMeta {
  name: string;
  version: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
  credentialSchema: CredentialField[];
}

export interface ProviderPlugin {
  meta: ProviderMeta;
  validate(credentials: Record<string, string>): Promise<{ valid: boolean; errors?: string[] }>;
  test(credentials: Record<string, string>): Promise<HealthStatus>;
}

export type WizardStep =
  | "choose_provider"
  | "enter_name"
  | "enter_credentials"
  | "save"
  | "test"
  | "complete";

export interface WizardState {
  step: WizardStep;
  userId: number;
  provider?: string;
  name?: string;
  description?: string;
  tags?: string[];
  environment?: string;
  region?: string;
  credentials?: Record<string, string>;
  connectionId?: string;
  error?: string;
}

export interface ConnectionFilter {
  provider?: string;
  name?: string;
  tag?: string;
  status?: ConnectionStatus;
  environment?: string;
  ownerId?: number;
  region?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface ConnectionSearchResult {
  connections: Connection[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportExportData {
  version: string;
  exportedAt: string;
  connections: Array<{
    provider: string;
    name: string;
    description: string;
    encryptedCredentials: string;
    tags: string[];
    environment: string;
    region: string;
    metadata: Record<string, string>;
  }>;
}
