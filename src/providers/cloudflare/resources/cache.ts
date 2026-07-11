import { CloudflareClient } from "@/providers/cloudflare/client";

export class CloudflareCache {
  constructor(
    private readonly client: CloudflareClient,
    private readonly zoneId: string,
  ) {}

  async purgeEverything(): Promise<void> {
    await this.client.post(`/zones/${this.zoneId}/purge`, { purge_everything: true });
  }

  async purgeByUrl(urls: string[]): Promise<void> {
    await this.client.post(`/zones/${this.zoneId}/purge`, { files: urls });
  }

  async purgeByTag(tags: string[]): Promise<void> {
    await this.client.post(`/zones/${this.zoneId}/purge`, { tags });
  }

  async purgeByHost(hosts: string[]): Promise<void> {
    await this.client.post(`/zones/${this.zoneId}/purge`, { hosts });
  }

  async purgeByPrefix(prefixes: string[]): Promise<void> {
    await this.client.post(`/zones/${this.zoneId}/purge`, { prefixes });
  }
}
