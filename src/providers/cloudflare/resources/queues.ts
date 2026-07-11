import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfQueue {
  queue_id: string;
  queue_name: string;
  created_on: string;
  modified_on: string;
  producers_total_count?: number;
  consumers_total_count?: number;
}

export class CloudflareQueues {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listQueues(): Promise<CfQueue[]> {
    const { data } = await this.client.get<CfQueue[]>(`/accounts/${this.accountId}/queues`);
    return data.result;
  }

  async createQueue(name: string): Promise<CfQueue> {
    const { data } = await this.client.post<CfQueue>(`/accounts/${this.accountId}/queues`, { queue_name: name });
    return data.result;
  }

  async deleteQueue(queueId: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/queues/${queueId}`);
  }
}

export function queueSummary(q: CfQueue): string {
  return `${q.queue_name} (\`${q.queue_id.slice(0, 8)}…\`)`;
}
