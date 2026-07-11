import { CloudflareClient } from "@/providers/cloudflare/client";
import { Logger } from "@/core/logger/logger";
import type {
  D1Database, D1TableSchema, D1ColumnInfo, D1IndexInfo,
  D1IndexDetail, D1ForeignKey, D1QueryResult, D1TableBrowseOptions,
  D1TableBrowseResult, D1SafeQueryResult, D1Stats, D1HistoryEntry,
  D1Config, D1LogEntry, D1NavigationState, D1ConfirmState,
} from "@/providers/cloudflare/d1/types";

const DESTRUCTIVE_PATTERN = /^\s*(DROP|ALTER|TRUNCATE)\b/i;
const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE)\b/i;

export function classifySql(sql: string): "read" | "write" | "destructive" {
  if (DESTRUCTIVE_PATTERN.test(sql)) return "destructive";
  if (WRITE_PATTERN.test(sql)) return "write";
  return "read";
}

let historyCounter = 0;

export class D1DatabaseManager {
  private readonly client: CloudflareClient;
  private readonly config: D1Config;
  private readonly logs: D1LogEntry[] = [];
  private readonly logLimit = 500;

  private readonly navStates = new Map<number, D1NavigationState>();
  private readonly confirmStates = new Map<number, D1ConfirmState>();
  private readonly queryHistory = new Map<string, D1HistoryEntry[]>();

  constructor(
    config: D1Config,
    private readonly logger: Logger,
  ) {
    this.config = config;
    this.client = new CloudflareClient({ apiToken: config.apiToken, email: config.email, logger });
  }

  private async log(action: string, databaseId: string, sql?: string, error?: string, start?: number): Promise<void> {
    const entry: D1LogEntry = {
      action, databaseId, sql, error,
      timestamp: new Date().toISOString(),
      duration: start ? Date.now() - start : 0,
      success: !error,
    };
    this.logs.push(entry);
    if (this.logs.length > this.logLimit) this.logs.splice(0, this.logs.length - this.logLimit);
    if (error) this.logger.error(`D1 ${action} failed`, undefined, { databaseId, sql: sql?.slice(0, 100), error });
  }

  // ── Database Discovery ──

  async listDatabases(): Promise<D1Database[]> {
    const start = Date.now();
    try {
      const { data } = await this.client.get<D1Database[]>(`/accounts/${this.config.accountId}/d1/database`);
      await this.log("listDatabases", "", undefined, undefined, start);
      return data.result;
    } catch (e) {
      await this.log("listDatabases", "", undefined, String(e), start);
      throw e;
    }
  }

  async getDatabase(databaseId: string): Promise<D1Database> {
    const start = Date.now();
    try {
      const { data } = await this.client.get<D1Database>(`/accounts/${this.config.accountId}/d1/database/${databaseId}`);
      await this.log("getDatabase", databaseId, undefined, undefined, start);
      return data.result;
    } catch (e) {
      await this.log("getDatabase", databaseId, undefined, String(e), start);
      throw e;
    }
  }

  async createDatabase(name: string): Promise<D1Database> {
    const start = Date.now();
    try {
      const { data } = await this.client.post<D1Database>(`/accounts/${this.config.accountId}/d1/database`, { name });
      await this.log("createDatabase", "", undefined, undefined, start);
      return data.result;
    } catch (e) {
      await this.log("createDatabase", "", undefined, String(e), start);
      throw e;
    }
  }

  async deleteDatabase(databaseId: string): Promise<void> {
    const start = Date.now();
    try {
      await this.client.delete(`/accounts/${this.config.accountId}/d1/database/${databaseId}`);
      await this.log("deleteDatabase", databaseId, undefined, undefined, start);
    } catch (e) {
      await this.log("deleteDatabase", databaseId, undefined, String(e), start);
      throw e;
    }
  }

  async validateDatabase(databaseId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.runQuery(databaseId, "SELECT 1");
      return { valid: true };
    } catch (e) {
      return { valid: false, error: String(e) };
    }
  }

  async healthCheck(databaseId: string): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const start = Date.now();
    try {
      await this.runQuery(databaseId, "SELECT 1");
      const latency = Date.now() - start;
      return { healthy: latency < 2000, latency };
    } catch (e) {
      return { healthy: false, latency: Date.now() - start, error: String(e) };
    }
  }

  // ── Schema Explorer ──

  async listTables(databaseId: string): Promise<D1TableSchema[]> {
    const result = await this.runQuery(databaseId, "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name");
    return (result.results ?? []).map((r) => ({ name: String(r.name ?? ""), sql: r.sql ? String(r.sql) : undefined, type: "table" as const }));
  }

  async listViews(databaseId: string): Promise<D1TableSchema[]> {
    const result = await this.runQuery(databaseId, "SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name");
    return (result.results ?? []).map((r) => ({ name: String(r.name ?? ""), sql: r.sql ? String(r.sql) : undefined, type: "view" as const }));
  }

  async listIndexes(databaseId: string): Promise<D1TableSchema[]> {
    const result = await this.runQuery(databaseId, "SELECT name, sql FROM sqlite_master WHERE type='index' ORDER BY name");
    return (result.results ?? []).map((r) => ({ name: String(r.name ?? ""), sql: r.sql ? String(r.sql) : undefined, type: "index" as const }));
  }

  async listTriggers(databaseId: string): Promise<D1TableSchema[]> {
    const result = await this.runQuery(databaseId, "SELECT name, sql FROM sqlite_master WHERE type='trigger' ORDER BY name");
    return (result.results ?? []).map((r) => ({ name: String(r.name ?? ""), sql: r.sql ? String(r.sql) : undefined, type: "trigger" as const }));
  }

  async getTableColumns(databaseId: string, table: string): Promise<D1ColumnInfo[]> {
    const result = await this.runQuery(databaseId, `PRAGMA table_info('${sanitizeIdentifier(table)}')`);
    return (result.results ?? []).map((r) => ({
      cid: Number(r.cid ?? 0),
      name: String(r.name ?? ""),
      type: String(r.type ?? ""),
      notnull: Number(r.notnull ?? 0),
      dflt_value: r.dflt_value !== null && r.dflt_value !== undefined ? String(r.dflt_value) : null,
      pk: Number(r.pk ?? 0),
    }));
  }

  async getForeignKeys(databaseId: string, table: string): Promise<D1ForeignKey[]> {
    const result = await this.runQuery(databaseId, `PRAGMA foreign_key_list('${sanitizeIdentifier(table)}')`);
    return (result.results ?? []).map((r) => ({
      id: Number(r.id ?? 0),
      seq: Number(r.seq ?? 0),
      table: String(r.table ?? ""),
      from: String(r.from ?? ""),
      to: String(r.to ?? ""),
      on_update: String(r.on_update ?? ""),
      on_delete: String(r.on_delete ?? ""),
      match: String(r.match ?? ""),
    }));
  }

  async getIndexList(databaseId: string, table: string): Promise<D1IndexInfo[]> {
    const result = await this.runQuery(databaseId, `PRAGMA index_list('${sanitizeIdentifier(table)}')`);
    return (result.results ?? []).map((r) => ({
      seq: Number(r.seq ?? 0),
      name: String(r.name ?? ""),
      unique: Number(r.unique ?? 0),
      origin: r.origin ? String(r.origin) : undefined,
      partial: r.partial !== undefined ? Number(r.partial) : undefined,
    }));
  }

  async getIndexColumns(databaseId: string, indexName: string): Promise<D1IndexDetail[]> {
    const result = await this.runQuery(databaseId, `PRAGMA index_info('${sanitizeIdentifier(indexName)}')`);
    return (result.results ?? []).map((r) => ({
      seqno: Number(r.seqno ?? 0),
      cid: Number(r.cid ?? 0),
      name: String(r.name ?? ""),
    }));
  }

  async getCreateStatement(databaseId: string, name: string): Promise<string | null> {
    const result = await this.runQuery(databaseId, `SELECT sql FROM sqlite_master WHERE name='${sanitizeIdentifier(name)}'`);
    const row = result.results?.[0];
    return row?.sql ? String(row.sql) : null;
  }

  // ── Table Browser ──

  async browseTable(databaseId: string, table: string, options: D1TableBrowseOptions = {}): Promise<D1TableBrowseResult> {
    const page = options.page ?? 0;
    const pageSize = Math.min(options.pageSize ?? 50, 200);
    const safeTable = sanitizeIdentifier(table);

    let columns: string[];
    if (options.columns?.length) {
      columns = options.columns;
    } else {
      const colInfo = await this.getTableColumns(databaseId, table);
      columns = colInfo.map((c) => c.name);
    }

    const colList = columns.map((c) => `"${c}"`).join(", ");

    let whereClauses: string[] = [];
    if (options.filterColumn && options.filterValue !== undefined) {
      whereClauses.push(`"${options.filterColumn}" = '${sanitizeValue(options.filterValue)}'`);
    }
    if (options.searchQuery) {
      const q = sanitizeValue(options.searchQuery);
      const searchCols = columns.map((c) => `"${c}" LIKE '%${q}%'`).join(" OR ");
      whereClauses.push(`(${searchCols})`);
    }
    const where = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    const orderBy = options.sortColumn
      ? ` ORDER BY "${options.sortColumn}" ${options.sortDirection === "DESC" ? "DESC" : "ASC"}`
      : "";

    const countResult = await this.runQuery(databaseId, `SELECT COUNT(*) as cnt FROM "${safeTable}"${where}`);
    const total = Number((countResult.results?.[0]?.cnt) ?? 0);

    const offset = page * pageSize;
    const dataResult = await this.runQuery(databaseId, `SELECT ${colList} FROM "${safeTable}"${where}${orderBy} LIMIT ${pageSize} OFFSET ${offset}`);

    return {
      columns,
      rows: dataResult.results ?? [],
      total,
      page,
      pageSize,
    };
  }

  async getRowCount(databaseId: string, table: string): Promise<number> {
    const result = await this.runQuery(databaseId, `SELECT COUNT(*) as cnt FROM "${sanitizeIdentifier(table)}"`);
    return Number((result.results?.[0]?.cnt) ?? 0);
  }

  async getPrimaryKey(databaseId: string, table: string): Promise<string[]> {
    const columns = await this.getTableColumns(databaseId, table);
    return columns.filter((c) => c.pk > 0).map((c) => c.name);
  }

  // ── Query Runner ──

  async runQuery(databaseId: string, sql: string, _params?: unknown[]): Promise<D1QueryResult> {
    const { data } = await this.client.post<D1QueryResult[]>(`/accounts/${this.config.accountId}/d1/database/${databaseId}/query`, { sql });
    return data.result[0] ?? { success: false, meta: { changed_db: false, changes: 0, duration: 0 } };
  }

  async executeQuery(databaseId: string, sql: string, safeMode: boolean): Promise<D1SafeQueryResult> {
    const start = Date.now();
    const classification = classifySql(sql);

    if (safeMode && classification !== "read") {
      const elapsed = Date.now() - start;
      await this.recordHistory(databaseId, sql, elapsed, "error", "Safe mode blocks write queries", undefined);
      return { success: false, isReadOnly: true, error: "Safe Mode: Write queries are blocked. Use Advanced Mode to execute writes.", needsConfirmation: false };
    }

    if (classification === "destructive" || (classification === "write" && /UPDATE\s+\w+\s+SET\s+(?!.*WHERE)/i.test(sql))) {
      return { success: false, isReadOnly: false, error: "Confirmation required for destructive operation.", needsConfirmation: true };
    }

    try {
      const result = await this.runQuery(databaseId, sql);
      const elapsed = Date.now() - start;
      await this.recordHistory(databaseId, sql, elapsed, result.success ? "success" : "error", undefined, result.meta.changes);
      await this.log("query", databaseId, sql, result.success ? undefined : "Query failed", start);
      return {
        success: result.success,
        isReadOnly: classification === "read",
        results: result.results,
        meta: result.meta,
      };
    } catch (e) {
      const elapsed = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      await this.recordHistory(databaseId, sql, elapsed, "error", msg, undefined);
      await this.log("query", databaseId, sql, msg, start);
      return { success: false, isReadOnly: classification === "read", error: msg, needsConfirmation: false };
    }
  }

  async executeConfirmedQuery(databaseId: string, sql: string): Promise<D1SafeQueryResult> {
    const start = Date.now();
    try {
      const result = await this.runQuery(databaseId, sql);
      const elapsed = Date.now() - start;
      await this.recordHistory(databaseId, sql, elapsed, result.success ? "success" : "error", undefined, result.meta.changes);
      await this.log("confirmed_query", databaseId, sql, result.success ? undefined : "Query failed", start);
      return { success: result.success, isReadOnly: false, results: result.results, meta: result.meta };
    } catch (e) {
      const elapsed = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      await this.recordHistory(databaseId, sql, elapsed, "error", msg, undefined);
      await this.log("confirmed_query", databaseId, sql, msg, start);
      return { success: false, isReadOnly: false, error: msg, needsConfirmation: false };
    }
  }

  // ── Import / Export ──

  async exportDatabase(databaseId: string, format: "json" | "sql" | "csv"): Promise<string> {
    const tables = await this.listTables(databaseId);
    const parts: string[] = [];

    for (const table of tables) {
      const data = await this.browseTable(databaseId, table.name, { pageSize: 10000 });
      if (format === "json") {
        parts.push(JSON.stringify({ table: table.name, rows: data.rows }));
      } else if (format === "csv") {
        if (data.columns.length > 0) {
          parts.push(data.columns.join(","));
          for (const row of data.rows) {
            parts.push(data.columns.map((c) => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(","));
          }
        }
      } else {
        if (table.sql) parts.push(table.sql + ";");
        for (const row of data.rows) {
          const cols = data.columns.map((c) => `"${c}"`).join(", ");
          const vals = data.columns.map((c) => {
            const v = row[c];
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "number") return String(v);
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(", ");
          parts.push(`INSERT INTO "${table.name}" (${cols}) VALUES (${vals});`);
        }
      }
    }

    return parts.join(format === "json" ? "\n" : "\n");
  }

  async exportTable(databaseId: string, table: string, format: "json" | "csv" | "sql"): Promise<string> {
    const data = await this.browseTable(databaseId, table, { pageSize: 10000 });
    if (format === "json") return JSON.stringify(data.rows, null, 2);
    if (format === "csv") {
      if (!data.columns.length) return "";
      const lines = [data.columns.join(",")];
      for (const row of data.rows) {
        lines.push(data.columns.map((c) => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(","));
      }
      return lines.join("\n");
    }
    const createStmt = await this.getCreateStatement(databaseId, table);
    const lines: string[] = createStmt ? [createStmt + ";"] : [];
    for (const row of data.rows) {
      const cols = data.columns.map((c) => `"${c}"`).join(", ");
      const vals = data.columns.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      }).join(", ");
      lines.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals});`);
    }
    return lines.join("\n");
  }

  // ── Backup Architecture ──

  async prepareBackup(databaseId: string): Promise<{ dump: string; tableCount: number; totalRows: number; size: number }> {
    const db = await this.getDatabase(databaseId);
    const dump = await this.exportDatabase(databaseId, "sql");
    const tables = await this.listTables(databaseId);
    let totalRows = 0;
    for (const t of tables) {
      totalRows += await this.getRowCount(databaseId, t.name);
    }
    return { dump, tableCount: tables.length, totalRows, size: db.file_size };
  }

  // ── Statistics ──

  async getStats(databaseId: string): Promise<D1Stats> {
    const db = await this.getDatabase(databaseId);
    const [tables, views, indexes, triggers] = await Promise.all([
      this.listTables(databaseId),
      this.listViews(databaseId),
      this.listIndexes(databaseId),
      this.listTriggers(databaseId),
    ]);

    const rowCounts: Record<string, number> = {};
    let totalRows = 0;
    let largestTable: { name: string; rows: number } | null = null;

    for (const t of tables) {
      const count = await this.getRowCount(databaseId, t.name);
      rowCounts[t.name] = count;
      totalRows += count;
      if (!largestTable || count > largestTable.rows) largestTable = { name: t.name, rows: count };
    }

    const history = this.queryHistory.get(databaseId) ?? [];
    const recentQueries = history.filter((h) => h.status === "success").slice(-50);
    const avgTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, h) => sum + h.executionTime, 0) / recentQueries.length
      : 0;

    return {
      databaseId,
      databaseName: db.name,
      fileSize: db.file_size,
      version: db.version,
      tableCount: tables.length,
      viewCount: views.length,
      indexCount: indexes.length,
      triggerCount: triggers.length,
      created_at: db.created_at,
      rowCounts,
      largestTable,
      totalRows,
      queryCount: recentQueries.length,
      avgQueryTime: avgTime,
    };
  }

  // ── Navigation State ──

  getNavState(userId: number): D1NavigationState | undefined {
    return this.navStates.get(userId);
  }

  setNavState(userId: number, state: D1NavigationState): void {
    this.navStates.set(userId, state);
  }

  clearNavState(userId: number): void {
    this.navStates.delete(userId);
  }

  // ── Confirmation State ──

  getConfirmState(userId: number): D1ConfirmState | undefined {
    return this.confirmStates.get(userId);
  }

  setConfirmState(userId: number, state: D1ConfirmState): void {
    this.confirmStates.set(userId, state);
  }

  clearConfirmState(userId: number): void {
    this.confirmStates.delete(userId);
  }

  // ── Query History ──

  private recordHistory(databaseId: string, sql: string, executionTime: number, status: "success" | "error", error?: string, affectedRows?: number): void {
    historyCounter++;
    const entry: D1HistoryEntry = {
      id: `h_${historyCounter}`,
      databaseId,
      sql,
      executionTime,
      timestamp: new Date().toISOString(),
      status,
      affectedRows,
      error,
      isFavorite: false,
      isPinned: false,
    };
    let list = this.queryHistory.get(databaseId);
    if (!list) {
      list = [];
      this.queryHistory.set(databaseId, list);
    }
    list.push(entry);
    if (list.length > 200) list.splice(0, list.length - 200);
  }

  getQueryHistory(databaseId: string, limit = 20): D1HistoryEntry[] {
    return (this.queryHistory.get(databaseId) ?? []).slice(-limit).reverse();
  }

  toggleFavorite(historyId: string): boolean {
    for (const list of this.queryHistory.values()) {
      const entry = list.find((e) => e.id === historyId);
      if (entry) {
        entry.isFavorite = !entry.isFavorite;
        return entry.isFavorite;
      }
    }
    return false;
  }

  togglePinned(historyId: string): boolean {
    for (const list of this.queryHistory.values()) {
      const entry = list.find((e) => e.id === historyId);
      if (entry) {
        entry.isPinned = !entry.isPinned;
        return entry.isPinned;
      }
    }
    return false;
  }

  getFavorites(databaseId: string): D1HistoryEntry[] {
    return (this.queryHistory.get(databaseId) ?? []).filter((e) => e.isFavorite);
  }

  searchHistory(databaseId: string, query: string): D1HistoryEntry[] {
    const q = query.toLowerCase();
    return (this.queryHistory.get(databaseId) ?? []).filter((e) => e.sql.toLowerCase().includes(q));
  }

  // ── Search ──

  async searchSchema(databaseId: string, query: string): Promise<{ tables: D1TableSchema[]; columns: { table: string; column: D1ColumnInfo }[] }> {
    const q = query.toLowerCase();
    const tables = await this.listTables(databaseId);
    const matchedTables = tables.filter((t) => t.name.toLowerCase().includes(q));

    const matchedColumns: { table: string; column: D1ColumnInfo }[] = [];
    for (const t of tables) {
      const cols = await this.getTableColumns(databaseId, t.name);
      for (const c of cols) {
        if (c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)) {
          matchedColumns.push({ table: t.name, column: c });
        }
      }
    }

    return { tables: matchedTables, columns: matchedColumns };
  }

  // ── Logs ──

  getLogs(): D1LogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(action?: string, limit = 20): D1LogEntry[] {
    let filtered = this.logs;
    if (action) filtered = filtered.filter((l) => l.action === action);
    return filtered.slice(-limit).reverse();
  }
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "");
}

function sanitizeValue(value: string): string {
  return value.replace(/'/g, "''");
}
