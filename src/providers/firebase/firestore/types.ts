// ── Database ──

export interface FirestoreDatabase {
  name: string;
  locationId: string;
  type: "FIRESTORE_NATIVE" | "DATASTORE_MODE" | "UNSPECIFIED";
  concurrencyMode: "OPTIMISTIC" | "PESSIMISTIC" | "CONCURRENCY_MODE_UNSPECIFIED";
  versionRetentionPeriod: string;
  earliestVersionTime: string;
  pointInTimeRecoveryEnabled: boolean;
  appEngineIntegrationMode: "ENABLED" | "DISABLED" | "APPENGINE_INTEGRATION_MODE_UNSPECIFIED";
  keyPrefix: string;
  createTime: string;
  updateTime: string;
}

// ── Document ──

export interface FirestoreDocument {
  name: string;
  fields?: Record<string, Value>;
  createTime: string;
  updateTime: string;
}

export type Value = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  bytesValue?: string;
  referenceValue?: string;
  geoPointValue?: LatLng;
  arrayValue?: ArrayValue;
  mapValue?: MapValue;
};

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface ArrayValue {
  values?: Value[];
}

export interface MapValue {
  fields?: Record<string, Value>;
}

// ── Collection ──

export interface CollectionInfo {
  id: string;
  documentCount: number;
}

export interface CollectionStats {
  id: string;
  documentCount: number;
  totalSize: number;
}

// ── Query ──

export type FieldFilterOp =
  | "OPERATOR_UNSPECIFIED"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "EQUAL"
  | "NOT_EQUAL"
  | "ARRAY_CONTAINS"
  | "IN"
  | "NOT_IN"
  | "ARRAY_CONTAINS_ANY";

export type OrderDirection = "ASCENDING" | "DESCENDING";

export interface FieldFilter {
  field: { fieldPath: string };
  op: FieldFilterOp;
  value: Value;
}

export interface CompositeFilter {
  op: "AND" | "OR";
  filters: Filter[];
}

export type Filter = { fieldFilter: FieldFilter } | { compositeFilter: CompositeFilter };

export interface Order {
  field: { fieldPath: string };
  direction: OrderDirection;
}

export interface Cursor {
  values: Value[];
  before?: boolean;
}

export interface StructuredQuery {
  from: Array<{ collectionId: string; allDescendants?: boolean }>;
  select?: { fields: Array<{ fieldPath: string }> };
  where?: Filter;
  orderBy?: Order[];
  startAt?: Cursor;
  endAt?: Cursor;
  offset?: number;
  limit?: number;
}

export interface RunQueryRequest {
  structuredQuery: StructuredQuery;
  transaction?: string;
}

export interface RunQueryResponse {
  transaction?: string;
  document?: FirestoreDocument;
  readTime: string;
  skippedResults?: number;
}

export interface ListDocumentsResponse {
  documents: FirestoreDocument[];
  nextPageToken?: string;
}

export interface WriteResult {
  updateTime: string;
  transformResults?: Array<{ transformResults?: unknown }>;
}

export interface CommitResponse {
  writeResults: WriteResult[];
  commitTime: string;
}

// ── CRUD ──

export type CrudOperation = "create" | "read" | "update" | "delete" | "bulk_delete";

export interface DocumentWrite {
  update?: FirestoreDocument;
  delete?: string;
  transform?: { document: string; fieldTransforms: unknown[] };
}

// ── Safe Mode ──

export type ExecutionMode = "read_only" | "read_write";

// ── Browse Options ──

export interface BrowseOptions {
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
  orderDirection?: OrderDirection;
  mask?: string[];
}

export interface BrowseResult {
  documents: FirestoreDocument[];
  nextPageToken?: string;
  total?: number;
}

// ── Search ──

export interface SearchOptions {
  field?: string;
  op?: FieldFilterOp;
  value?: unknown;
  limit?: number;
}

export interface SearchResult {
  documents: FirestoreDocument[];
  query: string;
  executionTime: number;
}

// ── Stats ──

export interface FirestoreStats {
  databaseId: string;
  collectionCount: number;
  documentCount: number;
  collections: CollectionStats[];
  largestCollections: CollectionStats[];
  recentlyModified: FirestoreDocument[];
}

// ── Export ──

export type ExportFormat = "json" | "csv";

// ── Favorites / History ──

export interface FavoriteItem {
  id: string;
  type: "collection" | "document" | "query";
  path: string;
  label: string;
  addedAt: string;
}

export interface RecentItem {
  id: string;
  type: "collection" | "document" | "query";
  path: string;
  label: string;
  accessedAt: string;
}

export interface PinnedQuery {
  id: string;
  sql: string;
  label: string;
  pinnedAt: string;
}

// ── Navigation State ──

export interface FirestoreNavState {
  userId: number;
  collectionPath: string;
  databaseId: string;
  pageToken?: string;
  stack: string[];
}

// ── Query Execution Options ──

export interface ExecuteQueryOptions {
  select?: string[];
  filters?: Array<{ field: string; op: string; value: unknown }>;
  orderBy?: Array<{ field: string; direction?: "ASCENDING" | "DESCENDING" }>;
  limit?: number;
  offset?: number;
  allDescendants?: boolean;
  cursor?: { after?: unknown[]; before?: unknown[] };
}

// ── Logging ──

export interface FirestoreLogEntry {
  action: string;
  collection?: string;
  documentId?: string;
  timestamp: string;
  duration: number;
  success: boolean;
  error?: string;
}
