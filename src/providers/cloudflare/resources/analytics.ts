import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfAnalyticsDashboard {
  totals: Record<string, unknown>;
  timeseries: Record<string, unknown>[];
}

export class CloudflareAnalytics {
  constructor(private readonly client: CloudflareClient) {}

  async getZoneDashboard(zoneId: string, since?: string, until?: string): Promise<CfAnalyticsDashboard> {
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    const query = params.toString() ? `?${params.toString()}` : "";
    const { data } = await this.client.get<CfAnalyticsDashboard>(`/zones/${zoneId}/analytics/dashboard${query}`);
    return data.result;
  }
}
