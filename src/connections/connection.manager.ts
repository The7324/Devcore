import { Logger } from "@/core/logger/logger";
import { CredentialManager } from "@/connections/credential.manager";
import { ProviderRegistry } from "@/connections/provider.registry";
import { HealthTracker } from "@/connections/health";
import type { ConnectionStore } from "@/connections/store";
import type {
  Connection,
  ConnectionStatus,
  HealthStatus,
  ConnectionLog,
  ConnectionAction,
  ActiveConnection,
  ConnectionFilter,
  ConnectionSearchResult,
  ConnectionGroup,
} from "@/connections/types";

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `conn_${Date.now()}_${idCounter}`;
}

export class ConnectionManager {
  private readonly connections = new Map<string, Connection>();
  private readonly logs: ConnectionLog[] = [];
  private readonly groups = new Map<string, ConnectionGroup>();
  private readonly activeConnections = new Map<number, ActiveConnection>();

  constructor(
    private readonly credentials: CredentialManager,
    private readonly registry: ProviderRegistry,
    private readonly health: HealthTracker,
    private readonly logger: Logger,
    private readonly store?: ConnectionStore,
  ) {}

  async hydrate(): Promise<void> {
    if (!this.store) return;
    try {
      const conns = await this.store.loadConnections();
      for (const conn of conns) this.connections.set(conn.id, conn);
      const actives = await this.store.loadActiveConnections();
      for (const active of actives) this.activeConnections.set(active.userId, active);
      this.logger.info("Connections hydrated from D1", { connections: conns.length, active: actives.length });
    } catch (error) {
      this.logger.error("Failed to hydrate connections from D1", error);
    }
  }

  private async persist(conn: Connection): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.saveConnection(conn);
    } catch (error) {
      this.logger.error("Failed to persist connection to D1", error);
    }
  }

  async create(
    ownerId: number,
    provider: string,
    name: string,
    description: string,
    credentials: Record<string, string>,
    options?: {
      tags?: string[];
      environment?: string;
      region?: string;
      color?: string;
      icon?: string;
      metadata?: Record<string, string>;
    },
  ): Promise<Connection> {
    if (!this.registry.has(provider)) {
      throw new Error(`Unknown provider: "${provider}"`);
    }

    const existing = this.findByName(name, ownerId);
    if (existing) {
      throw new Error(`A connection named "${name}" already exists`);
    }

    const encrypted = await this.credentials.encryptCredentials(credentials);
    const now = new Date().toISOString();

    const connection: Connection = {
      id: generateId(),
      provider,
      name,
      description,
      encryptedCredentials: encrypted,
      status: "active",
      health: "unknown",
      createdAt: now,
      updatedAt: now,
      lastValidatedAt: null,
      lastUsedAt: null,
      ownerId,
      tags: options?.tags ?? [],
      environment: options?.environment ?? "production",
      region: options?.region ?? "",
      color: options?.color ?? "#6b7280",
      icon: options?.icon ?? "🔌",
      version: 1,
      metadata: options?.metadata ?? {},
    };

    this.connections.set(connection.id, connection);
    await this.persist(connection);
    this.logAction(connection.id, ownerId, "created", { provider, name });
    this.logger.info(`Connection created: ${name} (${provider})`, { ownerId });

    return connection;
  }

  get(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  getAll(): Connection[] {
    return [...this.connections.values()];
  }

  async update(
    id: string,
    userId: number,
    updates: Partial<Pick<Connection, "name" | "description" | "tags" | "environment" | "region" | "color" | "icon" | "status" | "metadata">>,
  ): Promise<Connection> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`Connection "${id}" not found`);

    const updated: Connection = {
      ...conn,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: conn.version + 1,
    };

    if (updates.name && updates.name !== conn.name) {
      const existing = this.findByName(updates.name, conn.ownerId);
      if (existing && existing.id !== id) {
        throw new Error(`A connection named "${updates.name}" already exists`);
      }
    }

    this.connections.set(id, updated);
    await this.persist(updated);
    this.logAction(id, userId, "modified", { changes: Object.keys(updates) });
    return updated;
  }

  async updateCredentials(id: string, userId: number, newCredentials: Record<string, string>): Promise<Connection> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`Connection "${id}" not found`);

    const encrypted = await this.credentials.encryptCredentials(newCredentials);
    const updated: Connection = {
      ...conn,
      encryptedCredentials: encrypted,
      updatedAt: new Date().toISOString(),
      version: conn.version + 1,
    };

    this.connections.set(id, updated);
    await this.persist(updated);
    this.logAction(id, userId, "credential_update", {});
    this.logger.info(`Credentials updated for: ${conn.name}`, { userId });
    return updated;
  }

  async delete(id: string, userId: number): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`Connection "${id}" not found`);

    this.connections.delete(id);
    this.activeConnections.delete(userId);
    if (this.store) {
      try {
        await this.store.deleteConnection(id);
      } catch (error) {
        this.logger.error("Failed to delete connection from D1", error);
      }
    }
    this.logAction(id, userId, "deleted", { name: conn.name });
    this.logger.info(`Connection deleted: ${conn.name}`, { userId });
  }

  async activate(id: string, userId: number): Promise<ActiveConnection> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`Connection "${id}" not found`);

    const active: ActiveConnection = {
      userId,
      connectionId: id,
      activatedAt: new Date().toISOString(),
    };

    this.activeConnections.set(userId, active);

    const updated: Connection = { ...conn, lastUsedAt: new Date().toISOString() };
    this.connections.set(id, updated);
    await this.persist(updated);
    if (this.store) {
      try {
        await this.store.saveActive(active);
      } catch (error) {
        this.logger.error("Failed to persist active connection to D1", error);
      }
    }

    this.logAction(id, userId, "activated", {});
    return active;
  }

  deactivate(userId: number): void {
    this.activeConnections.delete(userId);
    if (this.store) {
      void this.store.deleteActive(userId).catch((error) => {
        this.logger.error("Failed to remove active connection from D1", error);
      });
    }
  }

  getActive(userId: number): ActiveConnection | undefined {
    return this.activeConnections.get(userId);
  }

  getActiveConnection(userId: number): Connection | undefined {
    const active = this.activeConnections.get(userId);
    if (!active) return undefined;
    return this.connections.get(active.connectionId);
  }

  async validate(id: string, userId: number): Promise<{ valid: boolean; errors?: string[] }> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`Connection "${id}" not found`);

    const provider = this.registry.get(conn.provider);
    if (!provider) return { valid: false, errors: [`Provider "${conn.provider}" not found`] };

    const credentials = await this.credentials.decryptCredentials(conn.encryptedCredentials);
    const result = await provider.validate(credentials);

    const updated: Connection = {
      ...conn,
      lastValidatedAt: new Date().toISOString(),
      ...(!result.valid && { status: "error" as ConnectionStatus }),
    };
    this.connections.set(id, updated);
    await this.persist(updated);

    this.logAction(id, userId, "validated", { valid: result.valid, errors: result.errors });
    return result;
  }

  async checkHealth(id: string, userId: number): Promise<HealthStatus> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`Connection "${id}" not found`);

    const provider = this.registry.get(conn.provider);
    if (!provider) {
      this.health.set(id, "error");
      return "error";
    }

    const credentials = await this.credentials.decryptCredentials(conn.encryptedCredentials);
    const status = await provider.test(credentials);

    this.health.set(id, status);
    this.health.recordCheck(id, status);

    const updated: Connection = {
      ...conn,
      health: status,
      lastValidatedAt: new Date().toISOString(),
      ...(status === "error" ? { status: "error" as ConnectionStatus } : {}),
    };
    this.connections.set(id, updated);
    await this.persist(updated);

    this.logAction(id, userId, "health_check", { health: status });
    return status;
  }

  search(filter: ConnectionFilter): ConnectionSearchResult {
    let results = [...this.connections.values()];

    if (filter.provider) {
      results = results.filter((c) => c.provider === filter.provider);
    }
    if (filter.name) {
      results = results.filter((c) => c.name.toLowerCase().includes(filter.name!.toLowerCase()));
    }
    if (filter.tag) {
      results = results.filter((c) => c.tags.includes(filter.tag!));
    }
    if (filter.status) {
      results = results.filter((c) => c.status === filter.status);
    }
    if (filter.environment) {
      results = results.filter((c) => c.environment === filter.environment);
    }
    if (filter.ownerId) {
      results = results.filter((c) => c.ownerId === filter.ownerId);
    }
    if (filter.region) {
      results = results.filter((c) => c.region === filter.region);
    }
    if (filter.query) {
      const q = filter.query.toLowerCase();
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.provider.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const total = results.length;
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paged = results.slice(start, start + pageSize);

    return { connections: paged, total, page, pageSize };
  }

  getHealthSummary(): Record<string, number> {
    return this.health.getSummary();
  }

  getLogs(connectionId?: string, limit = 50): ConnectionLog[] {
    let result = this.logs;
    if (connectionId) {
      result = result.filter((l) => l.connectionId === connectionId);
    }
    return result.slice(-limit).reverse();
  }

  // Groups
  createGroup(name: string, description: string): ConnectionGroup {
    const group: ConnectionGroup = {
      id: generateId(),
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    this.groups.set(group.id, group);
    return group;
  }

  getGroups(): ConnectionGroup[] {
    return [...this.groups.values()];
  }

  // Tags
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const conn of this.connections.values()) {
      for (const tag of conn.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }

  // Import/export helpers
  getAllConnectionsData(): Connection[] {
    return [...this.connections.values()];
  }

  async importConnections(
    connections: Array<{
      provider: string;
      name: string;
      description: string;
      encryptedCredentials: string;
      tags: string[];
      environment: string;
      region: string;
      metadata: Record<string, string>;
    }>,
    ownerId: number,
  ): Promise<number> {
    let count = 0;
    for (const data of connections) {
      if (!this.registry.has(data.provider)) continue;
      if (this.findByName(data.name, ownerId)) continue;

      const now = new Date().toISOString();
      const conn: Connection = {
        id: generateId(),
        provider: data.provider,
        name: data.name,
        description: data.description,
        encryptedCredentials: data.encryptedCredentials,
        status: "active",
        health: "unknown",
        createdAt: now,
        updatedAt: now,
        lastValidatedAt: null,
        lastUsedAt: null,
        ownerId,
        tags: data.tags,
        environment: data.environment,
        region: data.region,
        color: "#6b7280",
        icon: "🔌",
        version: 1,
        metadata: data.metadata,
      };
      this.connections.set(conn.id, conn);
      await this.persist(conn);
      count++;
    }
    return count;
  }

  private findByName(name: string, ownerId: number): Connection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.name === name && conn.ownerId === ownerId) return conn;
    }
    return undefined;
  }

  private logAction(connectionId: string, userId: number, action: ConnectionAction, details: Record<string, unknown>): void {
    const log: ConnectionLog = {
      id: generateId(),
      connectionId,
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
      success: true,
    };
    this.logs.push(log);

    if (this.logs.length > 1000) {
      this.logs.splice(0, this.logs.length - 1000);
    }
  }
}
