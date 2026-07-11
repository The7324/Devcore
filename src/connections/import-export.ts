import type { Connection } from "@/connections/types";

export interface ExportPayload {
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

export function buildExportData(connections: Connection[]): ExportPayload {
  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    connections: connections.map((c) => ({
      provider: c.provider,
      name: c.name,
      description: c.description,
      encryptedCredentials: c.encryptedCredentials,
      tags: c.tags,
      environment: c.environment,
      region: c.region,
      metadata: c.metadata,
    })),
  };
}

export function parseImportData(json: string): ExportPayload {
  const data = JSON.parse(json) as ExportPayload;

  if (!data.version || !Array.isArray(data.connections)) {
    throw new Error("Invalid import data format");
  }

  for (const conn of data.connections) {
    if (!conn.provider || !conn.name || !conn.encryptedCredentials) {
      throw new Error(`Invalid connection entry: missing required fields`);
    }
  }

  return data;
}
