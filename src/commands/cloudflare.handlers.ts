import type { TelegramContext } from "@/telegram/types";
import type { ResourceApi } from "@/providers/cloudflare/resources";
import { zoneSummary, dnsRecordSummary } from "@/providers/cloudflare/resources/dns";
import { workerSummary } from "@/providers/cloudflare/resources/workers";
import { r2BucketSummary, r2ObjectSummary } from "@/providers/cloudflare/resources/r2";
import { d1DatabaseSummary } from "@/providers/cloudflare/resources/d1";
import { kvNamespaceSummary } from "@/providers/cloudflare/resources/kv";
import { pagesProjectSummary, pagesDeploymentSummary } from "@/providers/cloudflare/resources/pages";
import { queueSummary } from "@/providers/cloudflare/resources/queues";
import { streamVideoSummary } from "@/providers/cloudflare/resources/stream";
import { aiModelSummary } from "@/providers/cloudflare/resources/ai";
import { accessAppSummary, accessGroupSummary } from "@/providers/cloudflare/resources/zero-trust";
import { emailRouteSummary, emailDestinationSummary } from "@/providers/cloudflare/resources/email-routing";

function fmtList(items: string[], title: string): string {
  if (items.length === 0) return `*${title}*\n\n(none)`;
  return `*${title}*\n\n${items.map((s) => `• ${s}`).join("\n")}`;
}

export async function handleDns(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "zones") {
    const zones = await api.dns.listZones();
    await ctx.replyMarkdown(fmtList(zones.map(zoneSummary), "DNS Zones"));
  } else if (sub === "records" && args[1]) {
    const records = await api.dns.listRecords(args[1]);
    await ctx.replyMarkdown(fmtList(records.map(dnsRecordSummary), `DNS Records (${args[1]})`));
  } else if (sub === "record" && args[1] && args[2]) {
    const record = await api.dns.getRecord(args[1], args[2]);
    await ctx.replyMarkdown(fmtList([dnsRecordSummary(record)], "DNS Record"));
  } else {
    await ctx.replyText("Usage: /cloudflare dns zones|records <zoneId>|record <zoneId> <recordId>");
  }
}

export async function handleWorkers(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "list") {
    const scripts = await api.workers.listScripts();
    await ctx.replyMarkdown(fmtList(scripts.map(workerSummary), "Workers"));
  } else if (sub === "routes" && args[1]) {
    const routes = await api.workers.listRoutes(args[1]);
    await ctx.replyMarkdown(fmtList(routes.map((r) => `${r.pattern} → ${r.script}`), "Worker Routes"));
  } else {
    await ctx.replyText("Usage: /cloudflare workers list|routes <zoneId>");
  }
}

export async function handleR2(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "buckets") {
    const buckets = await api.r2.listBuckets();
    await ctx.replyMarkdown(fmtList(buckets.map(r2BucketSummary), "R2 Buckets"));
  } else if (sub === "objects" && args[1]) {
    const objects = await api.r2.listObjects(args[1], args[2]);
    await ctx.replyMarkdown(fmtList(objects.map(r2ObjectSummary), `R2 Objects (${args[1]})`));
  } else {
    await ctx.replyText("Usage: /cloudflare r2 buckets|objects <bucket> [prefix]");
  }
}

export async function handleD1(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "list") {
    const dbs = await api.d1.listDatabases();
    await ctx.replyMarkdown(fmtList(dbs.map(d1DatabaseSummary), "D1 Databases"));
  } else if (sub === "query" && args[1] && args[2]) {
    const results = await api.d1.query(args[1], args.slice(2).join(" "));
    const lines = results.map((r) => `changed: ${r.meta.changed_db}, changes: ${r.meta.changes}, duration: ${r.meta.duration}ms`);
    await ctx.replyMarkdown(fmtList(lines, "D1 Query Results"));
  } else {
    await ctx.replyText("Usage: /cloudflare d1 list|query <databaseId> <sql>");
  }
}

export async function handleKV(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "namespaces") {
    const nss = await api.kv.listNamespaces();
    await ctx.replyMarkdown(fmtList(nss.map(kvNamespaceSummary), "KV Namespaces"));
  } else {
    await ctx.replyText("Usage: /cloudflare kv namespaces");
  }
}

export async function handlePages(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "list") {
    const projects = await api.pages.listProjects();
    await ctx.replyMarkdown(fmtList(projects.map(pagesProjectSummary), "Pages Projects"));
  } else if (sub === "deployments" && args[1]) {
    const deploys = await api.pages.listDeployments(args[1]);
    await ctx.replyMarkdown(fmtList(deploys.map(pagesDeploymentSummary), `Pages Deployments (${args[1]})`));
  } else {
    await ctx.replyText("Usage: /cloudflare pages list|deployments <project>");
  }
}

export async function handleCache(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  if (!args[0]) {
    await ctx.replyText("Usage: /cloudflare cache <zoneId> everything|url|tag|host|prefix <values...>");
    return;
  }
  const zoneId = args[0];
  const action = args[1];
  const values = args.slice(2);

  if (action === "everything") {
    await api.cache(zoneId).purgeEverything();
    await ctx.replyMarkdown(`✅ Cache purged for zone \`${zoneId}\``);
  } else if (action === "url" && values.length) {
    await api.cache(zoneId).purgeByUrl(values);
    await ctx.replyMarkdown(`✅ Purged ${values.length} URL(s)`);
  } else if (action === "tag" && values.length) {
    await api.cache(zoneId).purgeByTag(values);
    await ctx.replyMarkdown(`✅ Purged ${values.length} tag(s)`);
  } else if (action === "host" && values.length) {
    await api.cache(zoneId).purgeByHost(values);
    await ctx.replyMarkdown(`✅ Purged ${values.length} host(s)`);
  } else if (action === "prefix" && values.length) {
    await api.cache(zoneId).purgeByPrefix(values);
    await ctx.replyMarkdown(`✅ Purged ${values.length} prefix(es)`);
  } else {
    await ctx.replyText("Usage: /cloudflare cache <zoneId> everything|url|tag|host|prefix <values...>");
  }
}

export async function handleQueues(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "list") {
    const queues = await api.queues.listQueues();
    await ctx.replyMarkdown(fmtList(queues.map(queueSummary), "Queues"));
  } else {
    await ctx.replyText("Usage: /cloudflare queues list");
  }
}

export async function handleAnalytics(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  if (!args[0]) {
    await ctx.replyText("Usage: /cloudflare analytics zone <zoneId>");
    return;
  }
  const zoneId = args[0];
  const dash = await api.analytics.getZoneDashboard(zoneId);
  const lines = [`*Analytics (${zoneId})*`, "", `Totals: \`${JSON.stringify(dash.totals)}\``];
  await ctx.replyMarkdown(lines.join("\n"));
}

export async function handleStream(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "list") {
    const videos = await api.stream.listVideos();
    await ctx.replyMarkdown(fmtList(videos.map(streamVideoSummary), "Stream Videos"));
  } else {
    await ctx.replyText("Usage: /cloudflare stream list");
  }
}

export async function handleAI(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "models") {
    const models = await api.ai.listModels();
    await ctx.replyMarkdown(fmtList(models.map(aiModelSummary).slice(0, 50), "AI Models"));
  } else {
    await ctx.replyText("Usage: /cloudflare ai models");
  }
}

export async function handleAccess(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === "apps") {
    const apps = await api.zeroTrust.listAccessApps();
    await ctx.replyMarkdown(fmtList(apps.map(accessAppSummary), "Access Apps"));
  } else if (sub === "groups") {
    const groups = await api.zeroTrust.listAccessGroups();
    await ctx.replyMarkdown(fmtList(groups.map(accessGroupSummary), "Access Groups"));
  } else {
    await ctx.replyText("Usage: /cloudflare access apps|groups");
  }
}

export async function handleEmail(ctx: TelegramContext, api: ResourceApi, args: string[]): Promise<void> {
  const sub = args[0];

  if (sub === "settings" && args[1]) {
    const settings = await api.emailRouting(args[1]).getSettings();
    await ctx.replyMarkdown(fmtList([`Enabled: ${settings.enabled}`, `Zone: ${settings.name}`], "Email Routing Settings"));
  } else if (sub === "routes" && args[1]) {
    const routes = await api.emailRouting(args[1]).listRoutes();
    await ctx.replyMarkdown(fmtList(routes.map(emailRouteSummary), "Email Routes"));
  } else if (sub === "destinations") {
    const dests = await api.emailRouting("").listDestinations();
    await ctx.replyMarkdown(fmtList(dests.map(emailDestinationSummary), "Email Destinations"));
  } else {
    await ctx.replyText("Usage: /cloudflare email settings|routes <zoneId>|destinations");
  }
}

export const resourceHandlers: Record<string, (ctx: TelegramContext, api: ResourceApi, args: string[]) => Promise<void>> = {
  dns: handleDns,
  workers: handleWorkers,
  r2: handleR2,
  d1: handleD1,
  kv: handleKV,
  pages: handlePages,
  cache: handleCache,
  queues: handleQueues,
  analytics: handleAnalytics,
  stream: handleStream,
  ai: handleAI,
  access: handleAccess,
  email: handleEmail,
};
