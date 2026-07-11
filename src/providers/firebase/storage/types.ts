export interface StorageBucket {
  name: string;
  location: string;
  locationType: "multi-region" | "region" | "dual-region";
  storageClass: string;
  metageneration: string;
  etag: string;
  timeCreated: string;
  updated: string;
  defaultEventBasedHold: boolean;
  labels?: Record<string, string>;
  requesterPays: boolean;
  versioningEnabled: boolean;
  projectNumber: string;
}

export interface StorageObject {
  name: string;
  bucket: string;
  generation: string;
  metageneration: string;
  contentType: string;
  timeCreated: string;
  updated: string;
  size: string;
  md5Hash?: string;
  crc32c?: string;
  etag: string;
  storageClass: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  metadata?: Record<string, string>;
  owner?: { entity: string; entityId: string };
  componentCount?: number;
  timeDeleted?: string;
  temporaryHold?: boolean;
  eventBasedHold?: boolean;
  retentionExpirationTime?: string;
  kmsKeyName?: string;
  downloadTokens?: string[];
  id: string;
  selfLink: string;
  mediaLink: string;
}

export interface FolderItem {
  prefix: string;
  name: string;
}

export interface FileEntry {
  type: "file" | "folder";
  name: string;
  path: string;
  object?: StorageObject;
  size?: number;
  contentType?: string;
  updated?: string;
}

export interface BrowseResult {
  folders: FolderItem[];
  files: FileEntry[];
  nextPageToken?: string;
  prefixes: string[];
}

export interface BrowseOptions {
  prefix?: string;
  delimiter?: string;
  pageSize?: number;
  pageToken?: string;
  versions?: boolean;
}

export interface SearchOptions {
  prefix?: string;
  query?: string;
  maxResults?: number;
}

export interface SearchResult {
  files: FileEntry[];
  query: string;
  executionTime: number;
}

export interface StorageStats {
  bucketName: string;
  objectCount: number;
  totalSize: number;
  largestFiles: FileEntry[];
  newestFiles: FileEntry[];
  typeDistribution: Record<string, number>;
  location: string;
  storageClass: string;
}

export type CrudOperation = "upload" | "download" | "delete" | "rename" | "move" | "copy";

export interface UploadResult {
  object: StorageObject;
  path: string;
  size: number;
}

export interface BulkResult {
  succeeded: number;
  failed: number;
  errors: string[];
}

export interface FavoriteItem {
  id: string;
  type: "file" | "folder" | "bucket";
  path: string;
  label: string;
  addedAt: string;
}

export interface RecentItem {
  id: string;
  type: "file" | "folder" | "bucket";
  path: string;
  label: string;
  accessedAt: string;
}

export interface StorageLogEntry {
  action: string;
  bucket: string;
  path?: string;
  timestamp: string;
  duration: number;
  success: boolean;
  error?: string;
}

export interface StorageNavState {
  userId: number;
  bucket: string;
  prefix: string;
  pageToken?: string;
  stack: string[];
}
