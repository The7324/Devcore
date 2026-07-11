import { Logger } from "@/core/logger/logger";
import { StorageClient } from "@/providers/firebase/storage/client";
import type {
  StorageBucket,
  StorageObject,
  FileEntry,
  FolderItem,
  BrowseOptions,
  BrowseResult,
  SearchOptions,
  SearchResult,
  StorageStats,
  BulkResult,
  UploadResult,
  FavoriteItem,
  RecentItem,
  StorageLogEntry,
  StorageNavState,
} from "@/providers/firebase/storage/types";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/ogg", "audio/wav", "audio/flac", "audio/aac", "audio/mp4", "audio/webm"]);
const DOC_TYPES = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/html", "text/csv", "application/json", "application/xml", "text/markdown"]);
const ARCHIVE_TYPES = new Set(["application/zip", "application/x-tar", "application/gzip", "application/x-7z-compressed", "application/x-rar-compressed"]);

export function classifyContentType(ct: string): "image" | "video" | "audio" | "document" | "archive" | "other" {
  if (IMAGE_TYPES.has(ct)) return "image";
  if (VIDEO_TYPES.has(ct)) return "video";
  if (AUDIO_TYPES.has(ct)) return "audio";
  if (DOC_TYPES.has(ct)) return "document";
  if (ARCHIVE_TYPES.has(ct)) return "archive";
  return "other";
}

export function formatBytes(bytes: number | string): string {
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(n)) return "—";
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export class StorageManager {
  private readonly client: StorageClient;
  private readonly logs: StorageLogEntry[] = [];
  private readonly logLimit = 500;
  private favorites: FavoriteItem[] = [];
  private recents: RecentItem[] = [];
  private navStates = new Map<number, StorageNavState>();

  constructor(
    getToken: () => Promise<string>,
    private readonly projectId: string,
    private readonly logger: Logger,
    public defaultBucket: string = "",
  ) {
    this.client = new StorageClient(getToken, logger);
  }

  private async log(action: string, bucket: string, path?: string, error?: string, start?: number): Promise<void> {
    this.logs.push({ action, bucket, path, error, timestamp: new Date().toISOString(), duration: start ? Date.now() - start : 0, success: !error });
    if (this.logs.length > this.logLimit) this.logs.splice(0, this.logs.length - this.logLimit);
    if (error) this.logger.error(`Storage ${action} failed`, undefined, { bucket, path, error: error.slice(0, 100) });
  }

  getLogs() { return [...this.logs]; }

  // ── Buckets ──

  async listBuckets(): Promise<StorageBucket[]> {
    return this.client.listBuckets(this.projectId);
  }

  async getBucket(name: string): Promise<StorageBucket> {
    return this.client.getBucket(name);
  }

  async detectDefaultBucket(): Promise<string> {
    if (this.defaultBucket) return this.defaultBucket;
    const buckets = await this.listBuckets();
    if (buckets.length === 0) throw new Error("No storage buckets found in project");
    this.defaultBucket = buckets[0]!.name;
    return this.defaultBucket;
  }

  setDefaultBucket(name: string): void {
    this.defaultBucket = name;
  }

  // ── Folder Navigation ──

  async browse(
    bucket: string,
    prefix: string = "",
    options: BrowseOptions = {},
  ): Promise<BrowseResult> {
    const start = Date.now();
    try {
      const response = await this.client.listObjects(bucket, {
        prefix,
        delimiter: options.delimiter ?? "/",
        maxResults: options.pageSize ?? 50,
        pageToken: options.pageToken,
        versions: options.versions,
      });

      const folders: FolderItem[] = (response.prefixes ?? []).map((p) => ({
        prefix: p,
        name: p.replace(prefix, "").replace(/\/$/, ""),
      }));

      const files: FileEntry[] = (response.items ?? []).map((obj) => ({
        type: "file",
        name: obj.name.replace(prefix, ""),
        path: obj.name,
        object: obj,
        size: parseInt(obj.size, 10) || 0,
        contentType: obj.contentType,
        updated: obj.updated,
      }));

      this.addRecent("folder", prefix || "/", prefix || "(root)");
      await this.log("browse", bucket, prefix, undefined, start);
      return { folders, files, nextPageToken: response.nextPageToken, prefixes: response.prefixes ?? [] };
    } catch (e) {
      await this.log("browse", bucket, prefix, String(e), start);
      throw e;
    }
  }

  // ── File Operations ──

  async getFile(bucket: string, path: string): Promise<StorageObject> {
    const start = Date.now();
    try {
      const obj = await this.client.getObjectMetadata(bucket, path);
      this.addRecent("file", path, path.split("/").pop() ?? path);
      await this.log("getFile", bucket, path, undefined, start);
      return obj;
    } catch (e) {
      await this.log("getFile", bucket, path, String(e), start);
      throw e;
    }
  }

  async uploadFile(
    bucket: string,
    path: string,
    data: ArrayBuffer | Blob,
    contentType?: string,
  ): Promise<UploadResult> {
    const start = Date.now();
    try {
      const object = await this.client.uploadObject(bucket, path, data, contentType);
      this.addRecent("file", path, path.split("/").pop() ?? path);
      await this.log("upload", bucket, path, undefined, start);
      return { object, path, size: parseInt(object.size, 10) || 0 };
    } catch (e) {
      await this.log("upload", bucket, path, String(e), start);
      throw e;
    }
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const start = Date.now();
    try {
      await this.client.deleteObject(bucket, path);
      await this.log("delete", bucket, path, undefined, start);
    } catch (e) {
      await this.log("delete", bucket, path, String(e), start);
      throw e;
    }
  }

  async renameFile(bucket: string, sourcePath: string, destPath: string): Promise<StorageObject> {
    const start = Date.now();
    try {
      await this.client.copyObject(bucket, sourcePath, bucket, destPath);
      await this.client.deleteObject(bucket, sourcePath);
      const obj = await this.client.getObjectMetadata(bucket, destPath);
      await this.log("rename", bucket, `${sourcePath} → ${destPath}`, undefined, start);
      return obj;
    } catch (e) {
      await this.log("rename", bucket, `${sourcePath} → ${destPath}`, String(e), start);
      throw e;
    }
  }

  async moveFile(bucket: string, sourcePath: string, destBucket: string, destPath: string): Promise<StorageObject> {
    const start = Date.now();
    try {
      if (bucket === destBucket) {
        await this.client.copyObject(bucket, sourcePath, destBucket, destPath);
      } else {
        await this.client.rewriteObject(bucket, sourcePath, destBucket, destPath);
      }
      await this.client.deleteObject(bucket, sourcePath);
      const obj = await this.client.getObjectMetadata(destBucket, destPath);
      await this.log("move", bucket, `${sourcePath} → ${destBucket}:${destPath}`, undefined, start);
      return obj;
    } catch (e) {
      await this.log("move", bucket, `${sourcePath} → ${destBucket}:${destPath}`, String(e), start);
      throw e;
    }
  }

  async copyFile(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string,
  ): Promise<StorageObject> {
    const start = Date.now();
    try {
      const obj = await this.client.copyObject(sourceBucket, sourcePath, destBucket, destPath);
      await this.log("copy", sourceBucket, `${sourcePath} → ${destBucket}:${destPath}`, undefined, start);
      return obj;
    } catch (e) {
      await this.log("copy", sourceBucket, `${sourcePath} → ${destBucket}:${destPath}`, String(e), start);
      throw e;
    }
  }

  async duplicateFile(bucket: string, path: string): Promise<StorageObject> {
    const parts = path.split("/");
    const name = parts.pop() ?? "file";
    const parent = parts.join("/");
    const ts = Date.now();
    const newPath = parent ? `${parent}/${name}_copy_${ts}` : `copy_${ts}_${name}`;
    return this.copyFile(bucket, path, bucket, newPath);
  }

  async replaceFile(bucket: string, path: string, data: ArrayBuffer | Blob, contentType?: string): Promise<UploadResult> {
    // GCS overwrites on same path
    return this.uploadFile(bucket, path, data, contentType);
  }

  async bulkDelete(bucket: string, prefix: string): Promise<BulkResult> {
    const start = Date.now();
    const result: BulkResult = { succeeded: 0, failed: 0, errors: [] };
    try {
      const response = await this.client.listObjects(bucket, { prefix, maxResults: 200 });
      for (const obj of response.items ?? []) {
        try {
          await this.client.deleteObject(bucket, obj.name);
          result.succeeded++;
        } catch (e) {
          result.failed++;
          result.errors.push(`${obj.name}: ${e instanceof Error ? e.message : "Error"}`);
        }
      }
      await this.log("bulk_delete", bucket, prefix, undefined, start);
    } catch (e) {
      result.errors.push(`List failed: ${e instanceof Error ? e.message : "Error"}`);
    }
    return result;
  }

  // ── Search ──

  async searchFiles(bucket: string, options: SearchOptions): Promise<SearchResult> {
    const start = Date.now();
    const query = options.query?.toLowerCase() ?? "";
    const prefix = options.prefix ?? "";
    const maxResults = options.maxResults ?? 50;

    try {
      // List all objects under prefix, filter in memory for substring match
      const all: StorageObject[] = [];
      let pageToken: string | undefined;
      do {
        const response = await this.client.listObjects(bucket, {
          prefix,
          maxResults: 200,
          pageToken,
        });
        all.push(...(response.items ?? []));
        pageToken = response.nextPageToken;
      } while (pageToken && all.length < maxResults * 5);

      const filtered = all.filter((obj) => obj.name.toLowerCase().includes(query));
      const files = filtered.slice(0, maxResults).map((obj) => ({
        type: "file" as const,
        name: obj.name.split("/").pop() ?? obj.name,
        path: obj.name,
        object: obj,
        size: parseInt(obj.size, 10) || 0,
        contentType: obj.contentType,
        updated: obj.updated,
      }));

      const executionTime = Date.now() - start;
      return { files, query: options.query ?? "", executionTime };
    } catch (e) {
      throw new Error(`Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  // ── URLs ──

  getDownloadUrl(bucket: string, path: string): string {
    return this.client.getDownloadUrl(bucket, path);
  }

  getMediaLink(bucket: string, path: string): string {
    return this.client.getMediaLink(bucket, path);
  }

  getPublicUrl(bucket: string, path: string): string {
    return this.client.getPublicUrl(bucket, path);
  }

  // ── Stats ──

  async getStats(bucket: string): Promise<StorageStats> {
    const response = await this.client.listObjects(bucket, { maxResults: 500 });
    const items = response.items ?? [];

    let totalSize = 0;
    const typeDist: Record<string, number> = {};
    const all: FileEntry[] = [];

    for (const obj of items) {
      const size = parseInt(obj.size, 10) || 0;
      totalSize += size;
      const ct = obj.contentType ?? "unknown";
      const cat = classifyContentType(ct);
      typeDist[cat] = (typeDist[cat] ?? 0) + 1;
      all.push({
        type: "file",
        name: obj.name.split("/").pop() ?? obj.name,
        path: obj.name,
        object: obj,
        size,
        contentType: ct,
        updated: obj.updated,
      });
    }

    all.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    const largest = all.slice(0, 10);
    all.sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
    const newest = all.slice(0, 10);

    let bucketMeta: StorageBucket;
    try { bucketMeta = await this.client.getBucket(bucket); } catch { bucketMeta = { name: bucket, location: "—", locationType: "region", storageClass: "—", metageneration: "", etag: "", timeCreated: "", updated: "", defaultEventBasedHold: false, labels: {}, requesterPays: false, versioningEnabled: false, projectNumber: "" }; }

    return {
      bucketName: bucket,
      objectCount: all.length,
      totalSize,
      largestFiles: largest,
      newestFiles: newest,
      typeDistribution: typeDist,
      location: bucketMeta.location,
      storageClass: bucketMeta.storageClass,
    };
  }

  // ── Favorites ──

  getFavorites(type?: "file" | "folder" | "bucket"): FavoriteItem[] {
    if (type) return this.favorites.filter((f) => f.type === type);
    return [...this.favorites];
  }

  toggleFavorite(type: "file" | "folder" | "bucket", path: string, label: string): boolean {
    const idx = this.favorites.findIndex((f) => f.path === path && f.type === type);
    if (idx >= 0) { this.favorites.splice(idx, 1); return false; }
    this.favorites.push({ id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, path, label, addedAt: new Date().toISOString() });
    return true;
  }

  isFavorite(type: string, path: string): boolean {
    return this.favorites.some((f) => f.type === type && f.path === path);
  }

  private addRecent(type: "file" | "folder" | "bucket", path: string, label: string): void {
    const idx = this.recents.findIndex((r) => r.path === path && r.type === type);
    if (idx >= 0) this.recents.splice(idx, 1);
    this.recents.unshift({ id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, path, label, accessedAt: new Date().toISOString() });
    if (this.recents.length > 50) this.recents.splice(50);
  }

  getRecents(type?: "file" | "folder" | "bucket", limit = 20): RecentItem[] {
    if (type) return this.recents.filter((r) => r.type === type).slice(0, limit);
    return this.recents.slice(0, limit);
  }

  // ── Navigation State ──

  getNavState(userId: number) { return this.navStates.get(userId); }
  setNavState(userId: number, state: StorageNavState) { this.navStates.set(userId, state); }
  clearNavState(userId: number) { this.navStates.delete(userId); }
}
