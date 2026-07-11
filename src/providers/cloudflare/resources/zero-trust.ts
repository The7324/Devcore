import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfAccessApp {
  id: string;
  name: string;
  domain: string;
  type: string;
  created_on: string;
  aud: string;
}

export interface CfAccessGroup {
  id: string;
  name: string;
  created_on: string;
  modified_on: string;
  include: unknown[];
  exclude: unknown[];
  require: unknown[];
}

export interface CfAccessPolicy {
  id: string;
  name: string;
  decision: string;
  created_on: string;
  modified_on: string;
  include: unknown[];
  exclude: unknown[];
  require: unknown[];
}

export class CloudflareZeroTrust {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listAccessApps(): Promise<CfAccessApp[]> {
    const { data } = await this.client.get<CfAccessApp[]>(`/accounts/${this.accountId}/access/apps`);
    return data.result;
  }

  async getAccessApp(appId: string): Promise<CfAccessApp> {
    const { data } = await this.client.get<CfAccessApp>(`/accounts/${this.accountId}/access/apps/${appId}`);
    return data.result;
  }

  async listAccessGroups(): Promise<CfAccessGroup[]> {
    const { data } = await this.client.get<CfAccessGroup[]>(`/accounts/${this.accountId}/access/groups`);
    return data.result;
  }

  async listPolicies(appId: string): Promise<CfAccessPolicy[]> {
    const { data } = await this.client.get<CfAccessPolicy[]>(`/accounts/${this.accountId}/access/apps/${appId}/policies`);
    return data.result;
  }
}

export function accessAppSummary(a: CfAccessApp): string {
  return `${a.name} — ${a.domain} (${a.type})`;
}

export function accessGroupSummary(g: CfAccessGroup): string {
  return `${g.name} (\`${g.id.slice(0, 8)}…\`)`;
}
