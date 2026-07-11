import { describe, it, expect, beforeEach } from "vitest";
import { ConnectionManager } from "@/connections/connection.manager";
import { CredentialManager } from "@/connections/credential.manager";
import { ProviderRegistry } from "@/connections/provider.registry";
import { HealthTracker } from "@/connections/health";
import { Logger } from "@/core/logger/logger";
import type { ConnectionStore } from "@/connections/store";
import type { Connection, ActiveConnection, ProviderPlugin } from "@/connections/types";

const TEST_KEY = "0".repeat(64);

class FakeStore {
  saved: Connection[] = [];
  deleted: string[] = [];
  actives: ActiveConnection[] = [];
  seedConnections: Connection[] = [];
  seedActives: ActiveConnection[] = [];

  async loadConnections(): Promise<Connection[]> {
    return this.seedConnections;
  }
  async loadActiveConnections(): Promise<ActiveConnection[]> {
    return this.seedActives;
  }
  async saveConnection(conn: Connection): Promise<void> {
    this.saved.push(conn);
  }
  async deleteConnection(id: string): Promise<void> {
    this.deleted.push(id);
  }
  async saveActive(active: ActiveConnection): Promise<void> {
    this.actives.push(active);
  }
  async deleteActive(): Promise<void> {}
}

const fakePlugin: ProviderPlugin = {
  meta: {
    name: "fake",
    version: "1.0.0",
    description: "test",
    icon: "🔌",
    color: "#000",
    capabilities: [],
    credentialSchema: [],
  },
  async validate() {
    return { valid: true };
  },
  async test() {
    return "healthy";
  },
};

async function makeManager(store: FakeStore) {
  const registry = new ProviderRegistry();
  registry.register(fakePlugin);
  const credentials = new CredentialManager();
  await credentials.init(TEST_KEY);
  const health = new HealthTracker();
  const logger = new Logger();
  const manager = new ConnectionManager(
    credentials,
    registry,
    health,
    logger,
    store as unknown as ConnectionStore,
  );
  return manager;
}

describe("ConnectionManager D1 persistence wiring", () => {
  let store: FakeStore;
  let manager: ConnectionManager;

  beforeEach(async () => {
    store = new FakeStore();
    manager = await makeManager(store);
  });

  it("persists a connection to the store on create", async () => {
    const conn = await manager.create(1, "fake", "acc", "desc", { token: "x" });
    expect(store.saved.map((c) => c.id)).toContain(conn.id);
    expect(store.saved.at(-1)?.name).toBe("acc");
  });

  it("persists deletion to the store", async () => {
    const conn = await manager.create(1, "fake", "acc", "desc", { token: "x" });
    await manager.delete(conn.id, 1);
    expect(store.deleted).toContain(conn.id);
  });

  it("persists the active connection on activate", async () => {
    const conn = await manager.create(1, "fake", "acc", "desc", { token: "x" });
    await manager.activate(conn.id, 1);
    expect(store.actives.map((a) => a.connectionId)).toContain(conn.id);
  });

  it("hydrates connections and actives from the store", async () => {
    const seeded = await manager.create(1, "fake", "seed", "desc", { token: "x" });
    store.seedConnections = [seeded];
    store.seedActives = [{ userId: 1, connectionId: seeded.id, activatedAt: new Date().toISOString() }];

    const fresh = await makeManager(store);
    await fresh.hydrate();

    expect(fresh.get(seeded.id)?.name).toBe("seed");
    expect(fresh.getActive(1)?.connectionId).toBe(seeded.id);
  });
});
