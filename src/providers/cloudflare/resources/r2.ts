import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfR2Bucket {
  name: string;
  creation_date: string;
  location?: string;
}

export interface CfR2Object {
  key: string;
  size: number;
  uploaded: string;
  etag: string;
}

export class CloudflareR2 {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listBuckets(): Promise<CfR2Bucket[]> {
    const { data } = await this.client.get<CfR2Bucket[]>(`/accounts/${this.accountId}/r2/buckets`);
    return data.result;
  }

  async createBucket(name: string, location?: string): Promise<CfR2Bucket> {
    const { data } = await this.client.post<CfR2Bucket>(`/accounts/${this.accountId}/r2/buckets`, { name, ...(location && { location }) });
    return data.result;
  }

  async deleteBucket(name: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/r2/buckets/${name}`);
  }

  async listObjects(bucket: string, prefix?: string): Promise<CfR2Object[]> {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    const { data } = await this.client.get<CfR2Object[]>(`/accounts/${this.accountId}/r2/buckets/${bucket}/objects${query}`);
    return data.result;
  }
}

export function r2BucketSummary(bucket: CfR2Bucket): string {
  return `${bucket.name} (${bucket.location ?? "auto"}) — ${bucket.creation_date.slice(0, 10)}`;
}

export function r2ObjectSummary(obj: CfR2Object): string {
  const size = obj.size > 1024 * 1024 ? `${(obj.size / 1024 / 1024).toFixed(1)} MB` : `${(obj.size / 1024).toFixed(1)} KB`;
  return `${obj.key} — ${size}`;
}
