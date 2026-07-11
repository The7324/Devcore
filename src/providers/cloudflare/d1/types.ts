export interface D1Database {
  uuid: string;
  name: string;
  created_at: string;
  version: string;
  num_tables: number;
  file_size: number;
}

export interface D1TableSchema {
  name: string;
  sql?: string;
  type: "table" | "view" | "index" | "trigger";
}

export interface D1ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface D1IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin?: string;
  partial?: number;
}

export interface D1IndexDetail {
  seqno: number;
  cid: number;
  name: string;
}

export interface D1ForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

export interface D1QueryResult {
  success: boolean;
  meta: D1QueryMeta;
  results?: Record<string, unknown>[];
}

export interface D1QueryMeta {
  changed_db: boolean;
  changes: number;
  duration: number;
  last_row_id?: number;
  served_by?: string;
}

export interface D1TableBrowseOptions {
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDirection?: "ASC" | "DESC";
  filterColumn?: string;
  filterValue?: string;
  searchQuery?: string;
  columns?: string[];
}

export interface D1TableBrowseResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export interface D1SafeQueryResult {
  success: boolean;
  isReadOnly: boolean;
  results?: Record<string, unknown>[];
  meta?: D1QueryMeta;
  error?: string;
  needsConfirmation?: boolean;
}

export interface D1Stats {
  databaseId: string;
  databaseName: string;
  fileSize: number;
  version: string;
  tableCount: number;
  viewCount: number;
  indexCount: number;
  triggerCount: number;
  created_at: string;
  rowCounts: Record<string, number>;
  largestTable: { name: string; rows: number } | null;
  totalRows: number;
  queryCount: number;
  avgQueryTime: number;
}

export interface D1HistoryEntry {
  id: string;
  databaseId: string;
  sql: string;
  executionTime: number;
  timestamp: string;
  status: "success" | "error";
  affectedRows?: number;
  error?: string;
  isFavorite: boolean;
  isPinned: boolean;
}

export interface D1Config {
  accountId: string;
  apiToken: string;
  email?: string;
}

export interface D1LogEntry {
  action: string;
  databaseId: string;
  sql?: string;
  timestamp: string;
  duration: number;
  success: boolean;
  error?: string;
}

export interface D1NavigationState {
  userId: number;
  databaseId: string;
  databaseName: string;
  view: "tables" | "schema" | "browse" | "query";
  table?: string;
  page: number;
}

export interface D1ConfirmState {
  userId: number;
  databaseId: string;
  sql: string;
  type: "destructive" | "write";
  startedAt: number;
}
