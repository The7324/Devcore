import { CloudflareClient } from "@/providers/cloudflare/client";
import { CloudflareDNS } from "@/providers/cloudflare/resources/dns";
import { CloudflareWorkers } from "@/providers/cloudflare/resources/workers";
import { CloudflareR2 } from "@/providers/cloudflare/resources/r2";
import { CloudflareD1 } from "@/providers/cloudflare/resources/d1";
import { CloudflareKV } from "@/providers/cloudflare/resources/kv";
import { CloudflarePages } from "@/providers/cloudflare/resources/pages";
import { CloudflareCache } from "@/providers/cloudflare/resources/cache";
import { CloudflareQueues } from "@/providers/cloudflare/resources/queues";
import { CloudflareAnalytics } from "@/providers/cloudflare/resources/analytics";
import { CloudflareStream } from "@/providers/cloudflare/resources/stream";
import { CloudflareAI } from "@/providers/cloudflare/resources/ai";
import { CloudflareZeroTrust } from "@/providers/cloudflare/resources/zero-trust";
import { CloudflareEmailRouting } from "@/providers/cloudflare/resources/email-routing";

export class ResourceApi {
  readonly dns: CloudflareDNS;
  readonly workers: CloudflareWorkers;
  readonly r2: CloudflareR2;
  readonly d1: CloudflareD1;
  readonly kv: CloudflareKV;
  readonly pages: CloudflarePages;
  readonly cache: (zoneId: string) => CloudflareCache;
  readonly queues: CloudflareQueues;
  readonly analytics: CloudflareAnalytics;
  readonly stream: CloudflareStream;
  readonly ai: CloudflareAI;
  readonly zeroTrust: CloudflareZeroTrust;
  readonly emailRouting: (zoneId: string) => CloudflareEmailRouting;

  constructor(client: CloudflareClient, accountId: string) {
    this.dns = new CloudflareDNS(client);
    this.workers = new CloudflareWorkers(client, accountId);
    this.r2 = new CloudflareR2(client, accountId);
    this.d1 = new CloudflareD1(client, accountId);
    this.kv = new CloudflareKV(client, accountId);
    this.pages = new CloudflarePages(client, accountId);
    this.cache = (zoneId: string) => new CloudflareCache(client, zoneId);
    this.queues = new CloudflareQueues(client, accountId);
    this.analytics = new CloudflareAnalytics(client);
    this.stream = new CloudflareStream(client, accountId);
    this.ai = new CloudflareAI(client, accountId);
    this.zeroTrust = new CloudflareZeroTrust(client, accountId);
    this.emailRouting = (zoneId: string) => new CloudflareEmailRouting(client, accountId, zoneId);
  }
}
