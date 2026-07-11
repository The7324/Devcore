import type { StorageBucket, StorageObject } from "@/providers/firebase/storage/types";
import { Logger } from "@/core/logger/logger";

const GCS_JSON_API = "https://storage.googleapis.com/storage/v1";
const GCS_UPLOAD_API = "https://storage.googleapis.com/upload/storage/v1";

export class StorageApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "StorageApiError";
  }
}

export class StorageClient {
  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly logger?: Logger,
  ) {}

  private async request<T>(
    url: string,
    method: string = "GET",
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getToken();
    const start = Date.now();
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    };
    if (body !== undefined && !(body instanceof FormData)) init.body = JSON.stringify(body);
    if (body instanceof FormData) init.body = body;

    const response = await fetch(url, init);
    const latency = Date.now() - start;
    const bodyText = await response.text();

    if (!response.ok) {
      let errBody: { error?: { message?: string; code?: number } } | undefined;
      try { errBody = JSON.parse(bodyText); } catch { /* ignore */ }
      const msg = errBody?.error?.message ?? bodyText.slice(0, 200);
      this.logger?.error("GCS API error", undefined, { url, status: response.status, msg, latency });
      throw new StorageApiError(msg || `HTTP ${response.status}`, response.status, errBody?.error?.code);
    }

    return JSON.parse(bodyText) as T;
  }

  // ── Buckets ──

  async listBuckets(projectId: string): Promise<StorageBucket[]> {
    const { items } = await this.request<{ items?: StorageBucket[] }>(
      `${GCS_JSON_API}/b?project=${encodeURIComponent(projectId)}`,
    );
    return items ?? [];
  }

  async getBucket(bucketName: string): Promise<StorageBucket> {
    return this.request<StorageBucket>(`${GCS_JSON_API}/b/${encodeURIComponent(bucketName)}`);
  }

  // ── Objects ──

  async listObjects(
    bucket: string,
    options?: {
      prefix?: string;
      delimiter?: string;
      maxResults?: number;
      pageToken?: string;
      versions?: boolean;
    },
  ): Promise<{
    items?: StorageObject[];
    prefixes?: string[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();
    if (options?.prefix) params.set("prefix", options.prefix);
    if (options?.delimiter) params.set("delimiter", options.delimiter);
    if (options?.maxResults) params.set("maxResults", String(options.maxResults));
    if (options?.pageToken) params.set("pageToken", options.pageToken);
    if (options?.versions) params.set("versions", "true");
    return this.request(`${GCS_JSON_API}/b/${encodeURIComponent(bucket)}/o?${params}`);
  }

  async getObject(bucket: string, objectName: string): Promise<StorageObject> {
    return this.request<StorageObject>(
      `${GCS_JSON_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`,
    );
  }

  async getObjectMetadata(bucket: string, objectName: string): Promise<StorageObject> {
    return this.request<StorageObject>(
      `${GCS_JSON_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?fields=name,bucket,size,contentType,timeCreated,updated,md5Hash,crc32c,metadata,storageClass,contentDisposition,contentEncoding,contentLanguage,owner,generation,metageneration,etag,componentCount`,
    );
  }

  async uploadObject(
    bucket: string,
    objectName: string,
    data: ArrayBuffer | Blob,
    contentType?: string,
    metadata?: Record<string, string>,
  ): Promise<StorageObject> {
    const params = new URLSearchParams({ name: objectName, uploadType: "media" });
    if (metadata) {
      const encoded = encodeURIComponent(JSON.stringify(metadata));
      params.set("metadata", encoded);
    }
    const headers: Record<string, string> = {};
    if (contentType) headers["Content-Type"] = contentType;

    return this.request<StorageObject>(
      `${GCS_UPLOAD_API}/b/${encodeURIComponent(bucket)}/o?${params}`,
      "POST",
      data,
      headers,
    );
  }

  async uploadWithMetadata(
    bucket: string,
    objectName: string,
    body: FormData | Blob,
    contentType?: string,
  ): Promise<StorageObject> {
    const params = new URLSearchParams({ name: objectName, uploadType: "multipart" });
    const headers: Record<string, string> = {};
    if (contentType && body instanceof Blob) headers["Content-Type"] = contentType;

    return this.request<StorageObject>(
      `${GCS_UPLOAD_API}/b/${encodeURIComponent(bucket)}/o?${params}`,
      "POST",
      body,
      headers,
    );
  }

  async deleteObject(bucket: string, objectName: string): Promise<void> {
    await this.request(
      `${GCS_JSON_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`,
      "DELETE",
    );
  }

  async copyObject(
    sourceBucket: string,
    sourceObject: string,
    destBucket: string,
    destObject: string,
  ): Promise<StorageObject> {
    return this.request<StorageObject>(
      `${GCS_JSON_API}/b/${encodeURIComponent(sourceBucket)}/o/${encodeURIComponent(sourceObject)}/copyTo/b/${encodeURIComponent(destBucket)}/o/${encodeURIComponent(destObject)}`,
      "POST",
    );
  }

  async rewriteObject(
    sourceBucket: string,
    sourceObject: string,
    destBucket: string,
    destObject: string,
  ): Promise<{ rewriteToken?: string; done: boolean; totalBytesRewritten: string; objectSize: string; resource?: StorageObject }> {
    return this.request(
      `${GCS_JSON_API}/b/${encodeURIComponent(sourceBucket)}/o/${encodeURIComponent(sourceObject)}/rewriteTo/b/${encodeURIComponent(destBucket)}/o/${encodeURIComponent(destObject)}`,
      "POST",
    );
  }

  async patchObjectMetadata(
    bucket: string,
    objectName: string,
    patch: Partial<Pick<StorageObject, "metadata" | "contentType" | "contentDisposition" | "contentEncoding" | "contentLanguage">>,
  ): Promise<StorageObject> {
    return this.request<StorageObject>(
      `${GCS_JSON_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`,
      "PATCH",
      patch,
    );
  }

  getDownloadUrl(bucket: string, objectName: string): string {
    return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${encodeURIComponent(objectName)}`;
  }

  getMediaLink(bucket: string, objectName: string): string {
    return `${GCS_JSON_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  }

  getPublicUrl(bucket: string, objectName: string): string {
    return `https://storage.googleapis.com/${bucket}/${objectName}`;
  }
}
