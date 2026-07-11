import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfWorkerScript {
  id: string;
  name: string;
  tag: string;
  size: number;
  modified_on: string;
  migration_tag?: string;
}

export interface CfWorkerRoute {
  id: string;
  pattern: string;
  script: string;
  zone_id: string;
}

export class CloudflareWorkers {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listScripts(): Promise<CfWorkerScript[]> {
    const { data } = await this.client.get<CfWorkerScript[]>(`/accounts/${this.accountId}/workers/scripts`);
    return data.result;
  }

  async getScript(name: string): Promise<CfWorkerScript> {
    const { data } = await this.client.get<CfWorkerScript>(`/accounts/${this.accountId}/workers/scripts/${name}`);
    return data.result;
  }

  async deleteScript(name: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/workers/scripts/${name}`);
  }

  async listRoutes(zoneId: string): Promise<CfWorkerRoute[]> {
    const { data } = await this.client.get<CfWorkerRoute[]>(`/zones/${zoneId}/workers/routes`);
    return data.result;
  }
}

export function workerSummary(script: CfWorkerScript): string {
  return `${script.name} (${(script.size / 1024).toFixed(1)} KB) — ${script.modified_on.slice(0, 10)}`;
}
