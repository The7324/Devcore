import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfKVNamespace {
  id: string;
  title: string;
  supports_url_encoding?: boolean;
}

export interface CfKVKey {
  name: string;
  expiration?: number;
  metadata?: Record<string, string>;
}

export class CloudflareKV {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listNamespaces(): Promise<CfKVNamespace[]> {
    const { data } = await this.client.get<CfKVNamespace[]>(`/accounts/${this.accountId}/storage/kv/namespaces`);
    return data.result;
  }

  async createNamespace(title: string): Promise<CfKVNamespace> {
    const { data } = await this.client.post<CfKVNamespace>(`/accounts/${this.accountId}/storage/kv/namespaces`, { title });
    return data.result;
  }

  async deleteNamespace(id: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/storage/kv/namespaces/${id}`);
  }

  async listKeys(namespaceId: string, prefix?: string): Promise<CfKVKey[]> {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    const { data } = await this.client.get<CfKVKey[]>(`/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/keys${query}`);
    return data.result;
  }

  async getValue(namespaceId: string, key: string): Promise<string> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${this.client.token}` } },
    );
    if (!response.ok) throw new Error(`KV get failed: ${response.status}`);
    return response.text();
  }

  async putValue(namespaceId: string, key: string, value: string): Promise<void> {
    await this.client.put(
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
      value,
      { "Content-Type": "text/plain" },
    );
  }

  async deleteKey(namespaceId: string, key: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`);
  }
}

export function kvNamespaceSummary(ns: CfKVNamespace): string {
  return `${ns.title} (\`${ns.id.slice(0, 8)}…\`)`;
}
