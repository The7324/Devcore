import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfD1Database {
  uuid: string;
  name: string;
  created_at: string;
  version: string;
  num_tables: number;
  file_size: number;
}

export interface CfD1QueryResult {
  success: boolean;
  meta: { changed_db: boolean; changes: number; duration: number; last_row_id?: number };
  results?: Record<string, unknown>[];
}

export class CloudflareD1 {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listDatabases(): Promise<CfD1Database[]> {
    const { data } = await this.client.get<CfD1Database[]>(`/accounts/${this.accountId}/d1/database`);
    return data.result;
  }

  async createDatabase(name: string): Promise<CfD1Database> {
    const { data } = await this.client.post<CfD1Database>(`/accounts/${this.accountId}/d1/database`, { name });
    return data.result;
  }

  async deleteDatabase(id: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/d1/database/${id}`);
  }

  async query(databaseId: string, sql: string, params?: unknown[]): Promise<CfD1QueryResult[]> {
    const { data } = await this.client.post<CfD1QueryResult[]>(`/accounts/${this.accountId}/d1/database/${databaseId}/query`, { sql, params });
    return data.result;
  }
}

export function d1DatabaseSummary(db: CfD1Database): string {
  const size = db.file_size > 1024 * 1024 ? `${(db.file_size / 1024 / 1024).toFixed(1)} MB` : `${(db.file_size / 1024).toFixed(1)} KB`;
  return `${db.name} (${db.num_tables} tables, ${size})`;
}
