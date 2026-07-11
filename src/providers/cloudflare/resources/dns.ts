import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfZone {
  id: string;
  name: string;
  status: string;
  type: string;
  name_servers: string[];
  plan: { name: string };
  created_on: string;
}

export interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  zone_id: string;
  zone_name: string;
  created_on: string;
  modified_on: string;
}

export class CloudflareDNS {
  constructor(private readonly client: CloudflareClient) {}

  async listZones(): Promise<CfZone[]> {
    const { data } = await this.client.get<CfZone[]>("/zones");
    return data.result;
  }

  async getZone(zoneId: string): Promise<CfZone> {
    const { data } = await this.client.get<CfZone>(`/zones/${zoneId}`);
    return data.result;
  }

  async listRecords(zoneId: string): Promise<CfDnsRecord[]> {
    const { data } = await this.client.get<CfDnsRecord[]>(`/zones/${zoneId}/dns_records`);
    return data.result;
  }

  async getRecord(zoneId: string, recordId: string): Promise<CfDnsRecord> {
    const { data } = await this.client.get<CfDnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`);
    return data.result;
  }

  async createRecord(zoneId: string, record: { type: string; name: string; content: string; ttl?: number; proxied?: boolean }): Promise<CfDnsRecord> {
    const { data } = await this.client.post<CfDnsRecord>(`/zones/${zoneId}/dns_records`, record);
    return data.result;
  }

  async updateRecord(zoneId: string, recordId: string, record: Partial<CfDnsRecord>): Promise<CfDnsRecord> {
    const { data } = await this.client.patch<CfDnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, record);
    return data.result;
  }

  async deleteRecord(zoneId: string, recordId: string): Promise<void> {
    await this.client.delete(`/zones/${zoneId}/dns_records/${recordId}`);
  }
}

export function dnsRecordSummary(record: CfDnsRecord): string {
  const proxy = record.proxied ? " (proxied)" : "";
  return `${record.type} ${record.name} → ${record.content}${proxy}`;
}

export function zoneSummary(zone: CfZone): string {
  return `${zone.name} [${zone.status}] — ${zone.plan?.name ?? "Free"}`;
}
