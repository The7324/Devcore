import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfEmailRoutingSettings {
  enabled: boolean;
  zone_id: string;
  created_on: string;
  modified_on: string;
  name: string;
}

export interface CfEmailRoutingRule {
  tag: string;
  name: string;
  priority: number;
  enabled: boolean;
  actions: { type: string; value: string[] }[];
  matchers: { field: string; type: string; value: string }[];
  created_on: string;
  modified_on: string;
}

export interface CfEmailDestination {
  tag: string;
  email: string;
  verified: boolean;
  created: string;
  modified: string;
}

export class CloudflareEmailRouting {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
    private readonly zoneId: string,
  ) {}

  async getSettings(): Promise<CfEmailRoutingSettings> {
    const { data } = await this.client.get<CfEmailRoutingSettings>(`/zones/${this.zoneId}/email/routing`);
    return data.result;
  }

  async listRoutes(): Promise<CfEmailRoutingRule[]> {
    const { data } = await this.client.get<CfEmailRoutingRule[]>(`/zones/${this.zoneId}/email/routing/rules`);
    return data.result;
  }

  async createRoute(rule: { name: string; actions: { type: string; value: string[] }[]; matchers: { field: string; type: string; value: string }[] }): Promise<CfEmailRoutingRule> {
    const { data } = await this.client.post<CfEmailRoutingRule>(`/zones/${this.zoneId}/email/routing/rules`, rule);
    return data.result;
  }

  async deleteRoute(tag: string): Promise<void> {
    await this.client.delete(`/zones/${this.zoneId}/email/routing/rules/${tag}`);
  }

  async listDestinations(): Promise<CfEmailDestination[]> {
    const { data } = await this.client.get<CfEmailDestination[]>(`/accounts/${this.accountId}/email/routing/addresses`);
    return data.result;
  }
}

export function emailRouteSummary(r: CfEmailRoutingRule): string {
  const action = r.actions.map((a) => `${a.type}: ${a.value.join(", ")}`).join("; ");
  return `${r.name} → ${action} [${r.enabled ? "enabled" : "disabled"}]`;
}

export function emailDestinationSummary(d: CfEmailDestination): string {
  return `${d.email} ${d.verified ? "✓" : "✗"}`;
}
