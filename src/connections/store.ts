import { eq } from "drizzle-orm";
import type { Database } from "@/database";
import { connections, connectionTags, activeConnections } from "@/database/schema";
import type { Connection, ActiveConnection } from "@/connections/types";

export class ConnectionStore {
  constructor(private readonly db: Database) {}

  async loadConnections(): Promise<Connection[]> {
    const rows = await this.db.select().from(connections);
    const tagRows = await this.db.select().from(connectionTags);

    const tagsByConn = new Map<string, string[]>();
    for (const t of tagRows) {
      const list = tagsByConn.get(t.connectionId) ?? [];
      list.push(t.tag);
      tagsByConn.set(t.connectionId, list);
    }

    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      name: r.name,
      description: r.description,
      encryptedCredentials: r.encryptedCredentials,
      status: r.status,
      health: r.health,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lastValidatedAt: r.lastValidatedAt,
      lastUsedAt: r.lastUsedAt,
      ownerId: r.ownerId,
      tags: tagsByConn.get(r.id) ?? [],
      environment: r.environment,
      region: r.region,
      color: r.color,
      icon: r.icon,
      version: r.version,
      metadata: JSON.parse(r.metadata) as Record<string, string>,
    }));
  }

  async loadActiveConnections(): Promise<ActiveConnection[]> {
    const rows = await this.db.select().from(activeConnections);
    return rows.map((r) => ({
      userId: r.userId,
      connectionId: r.connectionId,
      activatedAt: r.activatedAt,
    }));
  }

  async saveConnection(conn: Connection): Promise<void> {
    const values = {
      id: conn.id,
      provider: conn.provider,
      name: conn.name,
      description: conn.description,
      encryptedCredentials: conn.encryptedCredentials,
      status: conn.status,
      health: conn.health,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
      lastValidatedAt: conn.lastValidatedAt,
      lastUsedAt: conn.lastUsedAt,
      ownerId: conn.ownerId,
      environment: conn.environment,
      region: conn.region,
      color: conn.color,
      icon: conn.icon,
      version: conn.version,
      metadata: JSON.stringify(conn.metadata),
    };

    await this.db
      .insert(connections)
      .values(values)
      .onConflictDoUpdate({ target: connections.id, set: values });

    await this.db.delete(connectionTags).where(eq(connectionTags.connectionId, conn.id));
    if (conn.tags.length > 0) {
      await this.db.insert(connectionTags).values(conn.tags.map((tag) => ({ connectionId: conn.id, tag })));
    }
  }

  async deleteConnection(id: string): Promise<void> {
    await this.db.delete(connections).where(eq(connections.id, id));
  }

  async saveActive(active: ActiveConnection): Promise<void> {
    await this.db
      .insert(activeConnections)
      .values(active)
      .onConflictDoUpdate({
        target: activeConnections.userId,
        set: { connectionId: active.connectionId, activatedAt: active.activatedAt },
      });
  }

  async deleteActive(userId: number): Promise<void> {
    await this.db.delete(activeConnections).where(eq(activeConnections.userId, userId));
  }
}
