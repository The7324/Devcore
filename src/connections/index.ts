import { Logger } from "@/core/logger/logger";
import type { Database } from "@/database";
import { CredentialManager } from "@/connections/credential.manager";
import { ProviderRegistry } from "@/connections/provider.registry";
import { ConnectionManager } from "@/connections/connection.manager";
import { HealthTracker } from "@/connections/health";
import { ConnectionWizard } from "@/connections/wizard";
import { ConnectionStore } from "@/connections/store";

export type { Connection, ConnectionGroup, ConnectionLog, ConnectionFilter, ConnectionSearchResult, ConnectionStatus, HealthStatus, ActiveConnection, ProviderPlugin, ProviderMeta, CredentialField, WizardState, WizardStep, ImportExportData } from "@/connections/types";

export { CredentialManager } from "@/connections/credential.manager";
export { ProviderRegistry } from "@/connections/provider.registry";
export { ConnectionManager } from "@/connections/connection.manager";
export { HealthTracker } from "@/connections/health";
export { ConnectionWizard } from "@/connections/wizard";
export { buildExportData, parseImportData } from "@/connections/import-export";
export { connectionCard, connectionSummary } from "@/connections/ui/card";
export { connectionListMarkdown, connectionListKeyboard } from "@/connections/ui/list";
export { deleteConfirmation, switchConfirmation, backKeyboard, cancelKeyboard } from "@/connections/ui/confirm";
export { providerSelector, environmentSelector } from "@/connections/ui/selector";
export { healthIcon, statusLabel, formatConnectionsCount } from "@/connections/ui/helpers";

export interface ConnectionsLayer {
  credentialManager: CredentialManager;
  providerRegistry: ProviderRegistry;
  manager: ConnectionManager;
  health: HealthTracker;
  wizard: ConnectionWizard;
}

let connectionsInitialized = false;

export async function setupConnections(
  encryptionKey: string | undefined,
  logger: Logger,
  db?: Database,
): Promise<ConnectionsLayer> {
  if (connectionsInitialized) {
    throw new Error("Connections layer is already initialized");
  }
  connectionsInitialized = true;

  const credentialManager = new CredentialManager();
  const providerRegistry = new ProviderRegistry();
  const health = new HealthTracker();
  const store = db ? new ConnectionStore(db) : undefined;
  const manager = new ConnectionManager(credentialManager, providerRegistry, health, logger, store);
  const wizard = new ConnectionWizard(manager, providerRegistry);

  if (encryptionKey) {
    await credentialManager.init(encryptionKey);
    logger.info("CredentialManager initialized with provided key");
  } else {
    logger.warn("No ENCRYPTION_KEY set — credential encryption disabled");
  }

  await manager.hydrate();

  return {
    credentialManager,
    providerRegistry,
    manager,
    health,
    wizard,
  };
}
