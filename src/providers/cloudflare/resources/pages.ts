import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfPagesProject {
  name: string;
  id: string;
  created_on: string;
  subdomain: string;
  domains: string[];
  source?: { type: string; config: Record<string, unknown> };
  latest_deployment?: CfPagesDeployment;
}

export interface CfPagesDeployment {
  id: string;
  short_id: string;
  project_name: string;
  environment: string;
  url: string;
  created_on: string;
  modified_on: string;
  latest_stage: { name: string; status: string };
  stages: { name: string; status: string }[];
  aliases?: string[];
}

export class CloudflarePages {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listProjects(): Promise<CfPagesProject[]> {
    const { data } = await this.client.get<CfPagesProject[]>(`/accounts/${this.accountId}/pages/projects`);
    return data.result;
  }

  async getProject(name: string): Promise<CfPagesProject> {
    const { data } = await this.client.get<CfPagesProject>(`/accounts/${this.accountId}/pages/projects/${name}`);
    return data.result;
  }

  async listDeployments(projectName: string): Promise<CfPagesDeployment[]> {
    const { data } = await this.client.get<CfPagesDeployment[]>(`/accounts/${this.accountId}/pages/projects/${projectName}/deployments`);
    return data.result;
  }

  async getDeployment(projectName: string, deploymentId: string): Promise<CfPagesDeployment> {
    const { data } = await this.client.get<CfPagesDeployment>(`/accounts/${this.accountId}/pages/projects/${projectName}/deployments/${deploymentId}`);
    return data.result;
  }
}

export function pagesProjectSummary(p: CfPagesProject): string {
  const deployment = p.latest_deployment;
  const status = deployment?.latest_stage?.status ?? "none";
  return `${p.name} — ${status} (${p.subdomain})`;
}

export function pagesDeploymentSummary(d: CfPagesDeployment): string {
  const stage = d.latest_stage;
  return `${d.short_id} — ${d.environment} — ${stage.name}: ${stage.status}`;
}
