import { Logger } from "@/core/logger/logger";
import { FirestoreClient } from "@/providers/firebase/firestore/client";
import type {
  FirestoreDatabase,
  FirestoreDocument,
  CollectionInfo,
  CollectionStats,
  BrowseOptions,
  BrowseResult,
  ExecuteQueryOptions,
  StructuredQuery,
  Filter,
  FieldFilterOp,
  Value,
  FirestoreStats,
  ExportFormat,
  SearchOptions,
  SearchResult,
  FavoriteItem,
  RecentItem,
} from "@/providers/firebase/firestore/types";
import { firestoreFieldsToJson, jsonToFirestoreValue } from "@/providers/firebase/firestore/format";

const FILTER_OP_MAP: Record<string, FieldFilterOp> = {
  "==": "EQUAL",
  "!=": "NOT_EQUAL",
  ">": "GREATER_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
  "<": "LESS_THAN",
  "<=": "LESS_THAN_OR_EQUAL",
  "array-contains": "ARRAY_CONTAINS",
  "in": "IN",
  "not-in": "NOT_IN",
  "array-contains-any": "ARRAY_CONTAINS_ANY",
};

export function classifySql(sql: string): "read" | "write" | "destructive" {
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith("DELETE") || upper.startsWith("DROP")) return "destructive";
  if (upper.startsWith("UPDATE") || upper.startsWith("CREATE") || upper.startsWith("INSERT") || upper.startsWith("SET")) return "write";
  return "read";
}


export class FirestoreManager {
  private readonly client: FirestoreClient;
  private readonly logs: Array<{ action: string; collection?: string; documentId?: string; timestamp: string; duration: number; success: boolean; error?: string }> = [];
  private readonly logLimit = 500;
  private favorites: FavoriteItem[] = [];
  private recents: RecentItem[] = [];
  // ponytail: fav key stored but not yet persisted; add localStorage/DB when cross-session persistence needed

  constructor(
    getToken: () => Promise<string>,
    projectId: string,
    private readonly logger: Logger,
    private readonly defaultDatabaseId: string = "(default)",
    _userId?: number,
  ) {
    this.client = new FirestoreClient(getToken, projectId, logger);
    // ponytail: fav persistence skipped; add when cross-session required
  }

  private async log(action: string, collection?: string, documentId?: string, error?: string, start?: number): Promise<void> {
    this.logs.push({
      action, collection, documentId, error,
      timestamp: new Date().toISOString(),
      duration: start ? Date.now() - start : 0,
      success: !error,
    });
    if (this.logs.length > this.logLimit) this.logs.splice(0, this.logs.length - this.logLimit);
    if (error) this.logger.error(`Firestore ${action} failed`, undefined, { collection, documentId, error: error.slice(0, 100) });
  }

  getLogs() { return [...this.logs]; }

  // ── Database Discovery ──

  async listDatabases(): Promise<FirestoreDatabase[]> {
    return this.client.listDatabases();
  }

  async getDatabase(databaseId?: string): Promise<FirestoreDatabase> {
    return this.client.getDatabase(databaseId ?? this.defaultDatabaseId);
  }

  getDefaultDatabaseId(): string {
    return this.defaultDatabaseId;
  }

  // ── Collection Explorer ──

  async listCollections(databaseId?: string): Promise<CollectionInfo[]> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    try {
      const allIds: string[] = [];
      let pageToken: string | undefined;
      do {
        const result = await this.client.listCollectionIds(db, 100, pageToken);
        allIds.push(...result.collectionIds);
        pageToken = result.nextPageToken;
      } while (pageToken);

      const collections: CollectionInfo[] = [];
      for (const id of allIds) {
        try {
          const docs = await this.client.listDocuments(db, id, { pageSize: 1, mask: ["__name__"] });
          const hasMore = docs.nextPageToken ? true : false;
          const count = hasMore ? -1 : docs.documents.length;
          collections.push({ id, documentCount: count });
        } catch {
          collections.push({ id, documentCount: 0 });
        }
      }
      collections.sort((a, b) => a.id.localeCompare(b.id));
      await this.log("listCollections", undefined, undefined, undefined, start);
      return collections;
    } catch (e) {
      await this.log("listCollections", undefined, undefined, String(e), start);
      throw e;
    }
  }

  async searchCollections(databaseId: string, query: string): Promise<CollectionInfo[]> {
    const all = await this.listCollections(databaseId);
    const q = query.toLowerCase();
    return all.filter((c) => c.id.toLowerCase().includes(q));
  }

  async getCollectionStats(databaseId: string, collectionId: string): Promise<CollectionStats> {
    const all = await this.listCollections(databaseId);
    const found = all.find((c) => c.id === collectionId);
    if (!found) throw new Error(`Collection "${collectionId}" not found`);
    return { id: found.id, documentCount: found.documentCount, totalSize: found.documentCount * 512 };
  }

  // ── Document Browser ──

  async browseDocuments(
    collectionPath: string,
    options: BrowseOptions = {},
    databaseId?: string,
  ): Promise<BrowseResult> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    try {
      const response = await this.client.listDocuments(db, collectionPath, {
        pageSize: options.pageSize ?? 20,
        pageToken: options.pageToken,
        orderBy: options.orderBy ? `${options.orderBy} ${options.orderDirection ?? "ASCENDING"}` : undefined,
        mask: options.mask,
      });

      await this.log("browse", collectionPath, undefined, undefined, start);
      return {
        documents: response.documents ?? [],
        nextPageToken: response.nextPageToken,
      };
    } catch (e) {
      await this.log("browse", collectionPath, undefined, String(e), start);
      throw e;
    }
  }

  async getDocument(path: string, databaseId?: string): Promise<FirestoreDocument> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    try {
      const doc = await this.client.getDocument(db, path);
      this.addRecent("document", path, extractDocId(path));
      await this.log("getDocument", path.split("/").slice(0, -1).join("/"), extractDocId(path), undefined, start);
      return doc;
    } catch (e) {
      await this.log("getDocument", path.split("/").slice(0, -1).join("/"), extractDocId(path), String(e), start);
      throw e;
    }
  }

  // ── CRUD ──

  async createDocument(
    collectionPath: string,
    data: Record<string, unknown>,
    documentId?: string,
    databaseId?: string,
  ): Promise<FirestoreDocument> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    try {
      const doc = await this.client.createDocument(db, collectionPath, documentId, data);
      const id = extractDocId(doc.name);
      await this.log("create", collectionPath, id, undefined, start);
      return doc;
    } catch (e) {
      await this.log("create", collectionPath, documentId, String(e), start);
      throw e;
    }
  }

  async updateDocument(
    path: string,
    data: Record<string, unknown>,
    mask?: string[],
    databaseId?: string,
  ): Promise<FirestoreDocument> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    try {
      const doc = await this.client.updateDocument(db, path, data, mask);
      await this.log("update", path.split("/").slice(0, -1).join("/"), extractDocId(path), undefined, start);
      return doc;
    } catch (e) {
      await this.log("update", path.split("/").slice(0, -1).join("/"), extractDocId(path), String(e), start);
      throw e;
    }
  }

  async deleteDocument(path: string, databaseId?: string): Promise<void> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    try {
      await this.client.deleteDocument(db, path);
      await this.log("delete", path.split("/").slice(0, -1).join("/"), extractDocId(path), undefined, start);
    } catch (e) {
      await this.log("delete", path.split("/").slice(0, -1).join("/"), extractDocId(path), String(e), start);
      throw e;
    }
  }

  async duplicateDocument(
    sourcePath: string,
    targetCollection: string,
    databaseId?: string,
  ): Promise<FirestoreDocument> {
    const db = databaseId ?? this.defaultDatabaseId;
    const doc = await this.getDocument(sourcePath, db);
    const data = firestoreFieldsToJson(doc.fields);
    const id = extractDocId(sourcePath);
    return this.createDocument(targetCollection, data, `${id}_copy`, db);
  }

  async copyDocument(
    sourcePath: string,
    targetPath: string,
    databaseId?: string,
  ): Promise<FirestoreDocument> {
    const db = databaseId ?? this.defaultDatabaseId;
    const doc = await this.getDocument(sourcePath, db);
    const data = firestoreFieldsToJson(doc.fields);
    return this.updateDocument(targetPath, data, undefined, db);
  }

  async bulkDelete(
    collectionPath: string,
    databaseId?: string,
    limit = 50,
  ): Promise<number> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    let deleted = 0;
    try {
      const response = await this.client.listDocuments(db, collectionPath, { pageSize: limit, mask: ["__name__"] });
      for (const doc of response.documents ?? []) {
        const path = doc.name.replace(/^.*\/documents\//, "");
        await this.client.deleteDocument(db, path);
        deleted++;
      }
      await this.log("bulk_delete", collectionPath, `${deleted} docs`, undefined, start);
      return deleted;
    } catch (e) {
      await this.log("bulk_delete", collectionPath, `${deleted} docs`, String(e), start);
      throw e;
    }
  }

  // ── Query Builder ──

  async executeQuery(
    collectionId: string,
    options: ExecuteQueryOptions,
    databaseId?: string,
  ): Promise<{ documents: FirestoreDocument[]; executionTime: number }> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();

    const query: StructuredQuery = {
      from: [{ collectionId, allDescendants: options.allDescendants ?? false }],
    };

    if (options.select?.length) {
      query.select = { fields: options.select.map((f) => ({ fieldPath: f })) };
    }

    if (options.filters?.length) {
      const filters: Filter[] = options.filters.map((f) => ({
        fieldFilter: {
          field: { fieldPath: f.field },
          op: FILTER_OP_MAP[f.op] ?? "EQUAL",
          value: jsonToFirestoreValue(f.value) as Value,
        },
      }));
      if (filters.length === 1) {
        query.where = filters[0]!;
      } else {
        query.where = { compositeFilter: { op: "AND", filters } };
      }
    }

    if (options.orderBy) {
      query.orderBy = options.orderBy.map((o) => ({
        field: { fieldPath: o.field },
        direction: o.direction ?? "ASCENDING",
      }));
    }

    if (options.limit) query.limit = options.limit;
    if (options.offset) query.offset = options.offset;

    if (options.cursor) {
      if (options.cursor.after) {
        query.startAt = { values: options.cursor.after.map((v) => jsonToFirestoreValue(v) as Value), before: false };
      }
      if (options.cursor.before) {
        query.endAt = { values: options.cursor.before.map((v) => jsonToFirestoreValue(v) as Value), before: false };
      }
    }

    await this.log("query", collectionId, undefined, undefined, start);
    try {
      const results = await this.client.runQuery(db, { structuredQuery: query });
      const executionTime = Date.now() - start;
      const documents = results
        .filter((r) => r.document)
        .map((r) => r.document!);
      return { documents, executionTime };
    } catch (e) {
      await this.log("query", collectionId, undefined, String(e), start);
      throw e;
    }
  }

  // ── Search ──

  async searchDocuments(
    collectionPath: string,
    options: SearchOptions,
    databaseId?: string,
  ): Promise<SearchResult> {
    const db = databaseId ?? this.defaultDatabaseId;

    const filters = options.field && options.op && options.value !== undefined
      ? [{ field: options.field, op: options.op, value: options.value }]
      : undefined;

    try {
      const { documents, executionTime } = await this.executeQuery(
        collectionPath,
        { filters, limit: options.limit ?? 20 },
        db,
      );
      return {
        documents,
        query: options.field ? `${options.field} ${options.op} ${options.value}` : "all",
        executionTime,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Search failed: ${msg}`);
    }
  }

  // ── Export ──

  async exportCollection(
    collectionPath: string,
    format: ExportFormat,
    databaseId?: string,
  ): Promise<string> {
    const db = databaseId ?? this.defaultDatabaseId;
    const start = Date.now();
    let allDocs: FirestoreDocument[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.client.listDocuments(db, collectionPath, {
        pageSize: 200,
        pageToken,
      });
      allDocs.push(...(response.documents ?? []));
      pageToken = response.nextPageToken;
    } while (pageToken);

    await this.log("export", collectionPath, `${allDocs.length} docs`, undefined, start);

    if (format === "csv") return this.toCsv(allDocs);
    return this.toJson(allDocs);
  }

  async exportDocument(path: string, format: ExportFormat, databaseId?: string): Promise<string> {
    const db = databaseId ?? this.defaultDatabaseId;
    const doc = await this.getDocument(path, db);
    const data = firestoreFieldsToJson(doc.fields);
    if (format === "csv") {
      const headers = Object.keys(data).join(",");
      const vals = Object.values(data).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      return `${headers}\n${vals}`;
    }
    return JSON.stringify({ id: extractDocId(doc.name), ...data }, null, 2);
  }

  async exportQueryResult(
    collectionPath: string,
    options: ExecuteQueryOptions,
    format: ExportFormat,
    databaseId?: string,
  ): Promise<string> {
    const { documents } = await this.executeQuery(collectionPath, options, databaseId);
    if (format === "csv") return this.toCsv(documents);
    return this.toJson(documents);
  }

  private toJson(docs: FirestoreDocument[]): string {
    const data = docs.map((d) => ({
      id: extractDocId(d.name),
      ...firestoreFieldsToJson(d.fields),
      _created: d.createTime,
      _updated: d.updateTime,
      _path: d.name,
    }));
    return JSON.stringify(data, null, 2);
  }

  private toCsv(docs: FirestoreDocument[]): string {
    if (!docs.length) return "";
    const allKeys = new Set<string>();
    const rows: Record<string, unknown>[] = docs.map((d) => {
      const data = firestoreFieldsToJson(d.fields);
      Object.keys(data).forEach((k) => allKeys.add(k));
      return { id: extractDocId(d.name), ...data };
    });
    const headers = ["id", ...allKeys];
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","));
    }
    return lines.join("\n");
  }

  // ── Statistics ──

  async getStats(databaseId?: string): Promise<FirestoreStats> {
    const db = databaseId ?? this.defaultDatabaseId;
    const collections = await this.listCollections(db);

    let totalDocs = 0;
    const all: CollectionStats[] = [];
    for (const c of collections) {
      const count = c.documentCount < 0 ? await this.countDocuments(c.id, db) : c.documentCount;
      totalDocs += count;
      all.push({ id: c.id, documentCount: count, totalSize: count * 512 });
    }

    all.sort((a, b) => b.documentCount - a.documentCount);
    const largest = all.slice(0, 10);

    const recentDocs: FirestoreDocument[] = [];
    for (const c of collections.slice(0, 5)) {
      try {
        const response = await this.client.listDocuments(db, c.id, { pageSize: 3, orderBy: "updateTime desc" });
        recentDocs.push(...(response.documents ?? []));
      } catch { /* skip */ }
    }
    recentDocs.sort((a, b) => b.updateTime.localeCompare(a.updateTime));
    const recentlyModified = recentDocs.slice(0, 10);

    return {
      databaseId: db,
      collectionCount: collections.length,
      documentCount: totalDocs,
      collections: all,
      largestCollections: largest,
      recentlyModified,
    };
  }

  private async countDocuments(collectionId: string, databaseId: string): Promise<number> {
    try {
      const { documents } = await this.executeQuery(
        collectionId,
        { select: ["__name__"], limit: 1000 },
        databaseId,
      );
      return documents.length;
    } catch {
      return 0;
    }
  }

  // ── Favorites ──

  getFavorites(type?: "collection" | "document" | "query"): FavoriteItem[] {
    if (type) return this.favorites.filter((f) => f.type === type);
    return [...this.favorites];
  }

  toggleFavorite(type: "collection" | "document" | "query", path: string, label: string): boolean {
    const idx = this.favorites.findIndex((f) => f.path === path && f.type === type);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
      return false;
    }
    this.favorites.push({
      id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      path,
      label,
      addedAt: new Date().toISOString(),
    });
    return true;
  }

  isFavorite(type: "collection" | "document" | "query", path: string): boolean {
    return this.favorites.some((f) => f.path === path && f.type === type);
  }

  // ── Recent Items ──

  private addRecent(type: "collection" | "document" | "query", path: string, label: string): void {
    const idx = this.recents.findIndex((r) => r.path === path && r.type === type);
    if (idx >= 0) this.recents.splice(idx, 1);
    this.recents.unshift({
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      path,
      label,
      accessedAt: new Date().toISOString(),
    });
    if (this.recents.length > 50) this.recents.splice(50);
  }

  getRecents(type?: "collection" | "document" | "query", limit = 20): RecentItem[] {
    if (type) return this.recents.filter((r) => r.type === type).slice(0, limit);
    return this.recents.slice(0, limit);
  }

  // ── Navigation State ──

  private navStates = new Map<number, { collectionPath: string; databaseId: string; pageToken?: string; stack: string[] }>();

  getNavState(userId: number) { return this.navStates.get(userId); }
  setNavState(userId: number, state: { collectionPath: string; databaseId: string; pageToken?: string; stack: string[] }) { this.navStates.set(userId, state); }
  clearNavState(userId: number) { this.navStates.delete(userId); }
}

export function extractDocId(name: string): string {
  return name.split("/").pop() ?? name;
}
