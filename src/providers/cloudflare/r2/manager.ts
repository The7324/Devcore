import { CloudflareClient } from "@/providers/cloudflare/client";
import { generatePresignedUrl } from "@/providers/cloudflare/r2/signer";
import type {
  R2BucketEntry, R2ObjectEntry, R2ObjectDetail, R2ObjectList,
  R2SearchQuery, R2BucketStats, R2UploadState, R2NavigationState,
  R2Favorites, R2SignedUrlOptions, R2LogEntry, R2Config,
} from "@/providers/cloudflare/r2/types";
import { Logger } from "@/core/logger/logger";

function r2S3Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function ext(key: string): string {
  const i = key.lastIndexOf(".");
  return i >= 0 ? key.slice(i + 1).toLowerCase() : "";
}

export class R2StorageManager {
  private readonly client: CloudflareClient;
  private readonly config: R2Config;
  private readonly logs: R2LogEntry[] = [];
  private readonly logLimit = 500;

  // Per-user state
  private readonly navState = new Map<number, R2NavigationState>();
  private readonly uploadState = new Map<number, R2UploadState>();
  private readonly favoritesMap = new Map<number, R2Favorites>();

  constructor(
    config: R2Config,
    private readonly logger: Logger,
  ) {
    this.config = config;
    this.client = new CloudflareClient({
      apiToken: config.apiToken,
      email: config.email,
      logger,
    });
  }

  private async log(action: string, bucket: string, key?: string, error?: string, start?: number): Promise<void> {
    const entry: R2LogEntry = {
      action, bucket, key: key ?? undefined,
      timestamp: new Date().toISOString(),
      duration: start ? Date.now() - start : 0,
      success: !error,
      error,
      latency: start ? Date.now() - start : 0,
    };
    this.logs.push(entry);
    if (this.logs.length > this.logLimit) this.logs.splice(0, this.logs.length - this.logLimit);
    if (error) this.logger.error(`R2 ${action} failed`, undefined, { bucket, key, error });
  }

  // ── Buckets ──

  async listBuckets(): Promise<R2BucketEntry[]> {
    const start = Date.now();
    try {
      const { data } = await this.client.get<R2BucketEntry[]>(`/accounts/${this.config.accountId}/r2/buckets`);
      await this.log("listBuckets", "", undefined, undefined, start);
      return data.result;
    } catch (e) {
      await this.log("listBuckets", "", undefined, String(e), start);
      throw e;
    }
  }

  async createBucket(name: string, location?: string): Promise<R2BucketEntry> {
    const start = Date.now();
    try {
      const { data } = await this.client.post<R2BucketEntry>(`/accounts/${this.config.accountId}/r2/buckets`, { name, ...(location && { location }) });
      await this.log("createBucket", name, undefined, undefined, start);
      return data.result;
    } catch (e) {
      await this.log("createBucket", name, undefined, String(e), start);
      throw e;
    }
  }

  async deleteBucket(name: string): Promise<void> {
    const start = Date.now();
    try {
      await this.client.delete(`/accounts/${this.config.accountId}/r2/buckets/${name}`);
      await this.log("deleteBucket", name, undefined, undefined, start);
    } catch (e) {
      await this.log("deleteBucket", name, undefined, String(e), start);
      throw e;
    }
  }

  // ── Objects ──

  async listObjects(bucket: string, prefix?: string, delimiter?: "/", cursor?: string, limit = 100): Promise<R2ObjectList> {
    const start = Date.now();
    try {
      const params = new URLSearchParams();
      if (prefix) params.set("prefix", prefix);
      if (delimiter) params.set("delimiter", delimiter);
      if (cursor) params.set("cursor", cursor);
      if (limit) params.set("limit", String(limit));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const { data } = await this.client.get<R2ObjectList>(`/accounts/${this.config.accountId}/r2/buckets/${bucket}/objects${qs}`);
      await this.log("listObjects", bucket, prefix, undefined, start);
      return data.result;
    } catch (e) {
      await this.log("listObjects", bucket, prefix, String(e), start);
      throw e;
    }
  }

  async getObject(bucket: string, key: string): Promise<R2ObjectDetail> {
    const start = Date.now();
    try {
      const { data } = await this.client.get<R2ObjectDetail>(`/accounts/${this.config.accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`);
      await this.log("getObject", bucket, key, undefined, start);
      return data.result;
    } catch (e) {
      await this.log("getObject", bucket, key, String(e), start);
      throw e;
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const start = Date.now();
    try {
      await this.client.delete(`/accounts/${this.config.accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`);
      await this.log("deleteObject", bucket, key, undefined, start);
    } catch (e) {
      await this.log("deleteObject", bucket, key, String(e), start);
      throw e;
    }
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    for (const key of keys) await this.deleteObject(bucket, key);
  }

  async copyObject(bucket: string, sourceKey: string, destKey: string): Promise<void> {
    const start = Date.now();
    try {
      await this.client.put(
        `/accounts/${this.config.accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(destKey)}`,
        undefined,
        { "Cf-Copy-Source": `/${bucket}/${encodeURIComponent(sourceKey)}` },
      );
      await this.log("copyObject", bucket, `${sourceKey}→${destKey}`, undefined, start);
    } catch (e) {
      await this.log("copyObject", bucket, `${sourceKey}→${destKey}`, String(e), start);
      throw e;
    }
  }

  async moveObject(bucket: string, sourceKey: string, destKey: string): Promise<void> {
    await this.copyObject(bucket, sourceKey, destKey);
    await this.deleteObject(bucket, sourceKey);
  }

  async renameObject(bucket: string, oldKey: string, newKey: string): Promise<void> {
    await this.moveObject(bucket, oldKey, newKey);
  }

  // ── Upload ──

  async uploadObject(bucket: string, key: string, data: ArrayBuffer | Blob, contentType?: string): Promise<R2ObjectDetail> {
    const start = Date.now();
    try {
      const body = data instanceof Blob ? data : new Blob([data]);
      const endpoint = r2S3Endpoint(this.config.accountId);
      const url = `${endpoint}/${bucket}/${encodeURIComponent(key)}`;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": contentType ?? "application/octet-stream",
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "Unknown error");
        throw new Error(`R2 upload failed (${response.status}): ${text}`);
      }

      const etag = response.headers.get("ETag") ?? "";
      await this.log("uploadObject", bucket, key, undefined, start);
      return { key, size: body.size, contentType: contentType ?? "application/octet-stream", etag, lastModified: new Date().toISOString(), storageClass: "Standard" };
    } catch (e) {
      await this.log("uploadObject", bucket, key, String(e), start);
      throw e;
    }
  }

  // ── Signed URLs ──

  async generateSignedUrl(bucket: string, options: R2SignedUrlOptions): Promise<string> {
    const start = Date.now();
    try {
      if (!this.config.apiTokenId) throw new Error("Token ID required for signed URLs");
      const url = await generatePresignedUrl({
        accessKey: this.config.apiTokenId,
        secretKey: this.config.apiToken,
        bucket,
        key: options.key,
        endpoint: r2S3Endpoint(this.config.accountId),
        expiresIn: options.expiresIn ?? 3600,
        method: options.method ?? "GET",
      }, this.logger);
      await this.log("signedUrl", bucket, options.key, undefined, start);
      return url;
    } catch (e) {
      await this.log("signedUrl", bucket, options.key, String(e), start);
      throw e;
    }
  }

  // ── Search ──

  async search(bucket: string, query: R2SearchQuery): Promise<R2ObjectEntry[]> {
    const params = new URLSearchParams();
    if (query.prefix) params.set("prefix", query.prefix);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.cursor) params.set("cursor", query.cursor);

    const qs = params.toString() ? `?${params.toString()}` : "";
    const { data } = await this.client.get<R2ObjectList>(`/accounts/${this.config.accountId}/r2/buckets/${bucket}/objects${qs}`);
    let results = data.result.objects;

    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter((o) => o.key.toLowerCase().includes(q));
    }
    if (query.extension) {
      results = results.filter((o) => ext(o.key) === query.extension!.toLowerCase());
    }
    if (query.minSize !== undefined) {
      results = results.filter((o) => o.size >= query.minSize!);
    }
    if (query.maxSize !== undefined) {
      results = results.filter((o) => o.size <= query.maxSize!);
    }
    if (query.before) {
      results = results.filter((o) => o.uploaded <= query.before!);
    }
    if (query.after) {
      results = results.filter((o) => o.uploaded >= query.after!);
    }
    if (query.path) {
      const p = query.path.endsWith("/") ? query.path : query.path + "/";
      results = results.filter((o) => o.key.startsWith(p));
    }

    return results;
  }

  // ── Stats ──

  async getStats(bucket: string): Promise<R2BucketStats> {
    const start = Date.now();
    try {
      const [buckets, allObjects] = await Promise.all([
        this.listBuckets(),
        this.listAllObjects(bucket),
      ]);

      const bucketMeta = buckets.find((b) => b.name === bucket);

      const objects = allObjects;
      const totalSize = objects.reduce((acc, o) => acc + o.size, 0);
      const sortedBySize = [...objects].sort((a, b) => b.size - a.size);
      const sortedByDate = [...objects].sort((a, b) => b.uploaded.localeCompare(a.uploaded));
      const sortedByOldest = [...objects].sort((a, b) => a.uploaded.localeCompare(b.uploaded));

      const typeDist: Record<string, number> = {};
      for (const o of objects) {
        const e = ext(o.key) || "(none)";
        typeDist[e] = (typeDist[e] ?? 0) + 1;
      }

      const stats: R2BucketStats = {
        name: bucket,
        objectCount: objects.length,
        totalSize,
        largestFiles: sortedBySize.slice(0, 10),
        newestUploads: sortedByDate.slice(0, 10),
        oldestFiles: sortedByOldest.slice(0, 10),
        typeDistribution: typeDist,
        createdDate: bucketMeta?.creation_date ?? "",
        location: bucketMeta?.location,
      };

      await this.log("getStats", bucket, undefined, undefined, start);
      return stats;
    } catch (e) {
      await this.log("getStats", bucket, undefined, String(e), start);
      throw e;
    }
  }

  private async listAllObjects(bucket: string): Promise<R2ObjectEntry[]> {
    const all: R2ObjectEntry[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.listObjects(bucket, undefined, undefined, cursor, 1000);
      all.push(...result.objects);
      cursor = result.cursor;
    } while (cursor);
    return all;
  }

  // ── Navigation State ──

  getNavState(userId: number): R2NavigationState | undefined {
    return this.navState.get(userId);
  }

  setNavState(userId: number, state: R2NavigationState): void {
    this.navState.set(userId, state);
  }

  clearNavState(userId: number): void {
    this.navState.delete(userId);
  }

  // ── Upload State ──

  getUploadState(userId: number): R2UploadState | undefined {
    return this.uploadState.get(userId);
  }

  setUploadState(userId: number, state: R2UploadState): void {
    this.uploadState.set(userId, state);
  }

  clearUploadState(userId: number): void {
    this.uploadState.delete(userId);
  }

  // ── Favorites ──

  private favStore(userId: number): R2Favorites {
    let f = this.favoritesMap.get(userId);
    if (!f) {
      f = { folders: [], files: [] };
      this.favoritesMap.set(userId, f);
    }
    return f;
  }

  addFavorite(userId: number, path: string, isFile: boolean): void {
    const f = this.favStore(userId);
    const list = isFile ? f.files : f.folders;
    if (!list.includes(path)) list.push(path);
  }

  removeFavorite(userId: number, path: string, isFile: boolean): void {
    const f = this.favStore(userId);
    const list = isFile ? f.files : f.folders;
    const idx = list.indexOf(path);
    if (idx >= 0) list.splice(idx, 1);
  }

  listFavorites(userId: number): R2Favorites {
    return { ...this.favStore(userId) };
  }

  isFavorite(userId: number, path: string, isFile: boolean): boolean {
    const f = this.favStore(userId);
    return isFile ? f.files.includes(path) : f.folders.includes(path);
  }

  // ── Recent Files (in-memory, per-user, max 50) ──

  private readonly recentMap = new Map<number, { key: string; bucket: string; timestamp: string }[]>();

  addRecent(userId: number, bucket: string, key: string): void {
    let list = this.recentMap.get(userId);
    if (!list) {
      list = [];
      this.recentMap.set(userId, list);
    }
    const existing = list.findIndex((e) => e.key === key && e.bucket === bucket);
    if (existing >= 0) list.splice(existing, 1);
    list.unshift({ key, bucket, timestamp: new Date().toISOString() });
    if (list.length > 50) list.pop();
  }

  getRecent(userId: number, limit = 10): { key: string; bucket: string; timestamp: string }[] {
    return (this.recentMap.get(userId) ?? []).slice(0, limit);
  }

  // ── Logs ──

  getLogs(): R2LogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(action?: string, limit = 20): R2LogEntry[] {
    let filtered = this.logs;
    if (action) filtered = filtered.filter((l) => l.action === action);
    return filtered.slice(-limit).reverse();
  }
}
