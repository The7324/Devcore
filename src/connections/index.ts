import { Logger } from "@/core/logger/logger";
import { CredentialManager } from "@/connections/credential.manager";
import { ProviderRegistry } from "@/connections/provider.registry";
import { ConnectionManager } from "@/connections/connection.manager";
import { HealthTracker } from "@/connections/health";
import { ConnectionWizard } from "@/connections/wizard";

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

export function setupConnections(
  encryptionKey: string | undefined,
  logger: Logger,
): ConnectionsLayer {
  if (connectionsInitialized) {
    throw new Error("Connections layer is already initialized");
  }
  connectionsInitialized = true;

  const credentialManager = new CredentialManager();
  const providerRegistry = new ProviderRegistry();
  const health = new HealthTracker();
  const manager = new ConnectionManager(credentialManager, providerRegistry, health, logger);
  const wizard = new ConnectionWizard(manager, providerRegistry);

  logger.info("Connections layer initialized", {
    encryptionReady: !!encryptionKey,
  });

  return {
    credentialManager,
    providerRegistry,
    manager,
    health,
    wizard,
  };
}
