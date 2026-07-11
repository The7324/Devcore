import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfAIModel {
  name: string;
  description: string;
  type: string;
  task: { id: string; name: string };
}

export interface CfAIRunResult {
  result: unknown;
  errors: { message: string }[];
  messages: { message: string }[];
  success: boolean;
}

export class CloudflareAI {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listModels(): Promise<CfAIModel[]> {
    const { data } = await this.client.get<CfAIModel[]>(`/accounts/${this.accountId}/ai/models/search`);
    return data.result;
  }

  async run(modelName: string, input: Record<string, unknown>): Promise<unknown> {
    const { data } = await this.client.post(`/accounts/${this.accountId}/ai/run/${modelName}`, input);
    return data.result;
  }
}

export function aiModelSummary(m: CfAIModel): string {
  return `${m.name} — ${m.task.name}`;
}
