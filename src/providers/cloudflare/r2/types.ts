export interface R2BucketEntry {
  name: string;
  creation_date: string;
  location?: string;
}

export interface R2ObjectEntry {
  key: string;
  size: number;
  uploaded: string;
  etag: string;
  storageClass?: string;
  checksums?: { md5?: string; sha256?: string };
  httpEtag?: string;
}

export interface R2ObjectDetail {
  key: string;
  size: number;
  contentType: string;
  etag: string;
  lastModified: string;
  storageClass: string;
  checksums?: { md5?: string; sha256?: string };
  uploadTimestamp?: string;
}

export interface R2ObjectList {
  objects: R2ObjectEntry[];
  prefixes: string[];
  truncated: boolean;
  cursor?: string;
}

export interface R2SearchQuery {
  query?: string;
  prefix?: string;
  extension?: string;
  minSize?: number;
  maxSize?: number;
  before?: string;
  after?: string;
  tag?: string;
  path?: string;
  limit?: number;
  cursor?: string;
}

export interface R2BucketStats {
  name: string;
  objectCount: number;
  totalSize: number;
  largestFiles: R2ObjectEntry[];
  newestUploads: R2ObjectEntry[];
  oldestFiles: R2ObjectEntry[];
  typeDistribution: Record<string, number>;
  createdDate: string;
  location?: string;
}

export interface R2UploadState {
  userId: number;
  bucket: string;
  path: string;
  fileName: string;
  overwrite: boolean;
  startedAt: number;
}

export interface R2NavigationState {
  userId: number;
  bucket: string;
  path: string;
  page: number;
  cursor?: string;
}

export interface R2Favorites {
  folders: string[];
  files: string[];
}

export interface R2SignedUrlOptions {
  key: string;
  expiresIn?: number;
  method?: "GET" | "PUT";
}

export interface R2LogEntry {
  action: string;
  bucket: string;
  key?: string;
  timestamp: string;
  duration: number;
  success: boolean;
  error?: string;
  latency: number;
}

export interface R2Config {
  accountId: string;
  apiToken: string;
  apiTokenId?: string;
  email?: string;
  s3Endpoint: string;
}
