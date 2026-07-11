import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import { CloudflareProviderPlugin } from "@/providers/cloudflare/plugin";
import { cloudflareCard, connectionDetailKeyboard } from "@/providers/cloudflare/ui";
import { resourceHandlers } from "@/commands/cloudflare.handlers";

export function createCloudflareCommand(layer: ConnectionsLayer): TelegramCommand {
  return {
    meta: {
      name: "cloudflare",
      description: "Manage Cloudflare connections",
      aliases: ["cf"],
      usage:
        "/cloudflare — list connections\n"
        + "/cloudflare status|validate|info|reconnect — connection management\n"
        + "/cloudflare dns zones|records <zoneId> — DNS operations\n"
        + "/cloudflare workers list|routes <zoneId> — Workers\n"
        + "/cloudflare r2 buckets|objects <bucket> — R2\n"
        + "/cloudflare d1 list|query <id> <sql> — D1\n"
        + "/cloudflare kv namespaces — KV\n"
        + "/cloudflare pages list|deployments <project> — Pages\n"
        + "/cloudflare cache <zoneId> everything|url|tag|host|prefix — Cache\n"
        + "/cloudflare queues list — Queues\n"
        + "/cloudflare analytics <zoneId> — Analytics\n"
        + "/cloudflare stream list — Stream\n"
        + "/cloudflare ai models — AI\n"
        + "/cloudflare access apps|groups — Zero Trust\n"
        + "/cloudflare email settings|routes|destinations — Email Routing",
    },
    permissions: [Permission.ProvidersManage],
    async handle(ctx) {
      const args = ctx.commandArgs;
      const sub = args[0]?.toLowerCase();

      if (sub && resourceHandlers[sub]) {
        await handleResourceCommand(ctx, layer, sub, args.slice(1));
        return;
      }

      switch (sub) {
        case "status":
          await handleStatus(ctx, layer);
          break;
        case "validate":
          await handleValidate(ctx, layer);
          break;
        case "info":
          await handleInfo(ctx, layer);
          break;
        case "reconnect":
          await handleReconnect(ctx, layer);
          break;
        default:
          await handleList(ctx, layer);
      }
    },
  };
}

async function handleList(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const all = layer.manager.getAll();
  const cf = all.filter((c) => c.provider === "Cloudflare");

  if (cf.length === 0) {
    await ctx.replyText(
      "No Cloudflare connections.\n\n"
      + "Use /connect to add one (select Cloudflare as provider).",
    );
    return;
  }

  const active = layer.manager.getActive(ctx.user!.id);
  const lines: string[] = ["*Cloudflare Connections*", ""];

  for (const conn of cf) {
    const isActive = active?.connectionId === conn.id;
    const prefix = isActive ? "🟢" : "⚪";
    lines.push(`${prefix} *${conn.name}* — ${conn.environment} (${conn.health})`);
  }

      lines.push(
    "",
    "Use /cloudflare status|validate|info|reconnect for connection management.",
    "Use /cloudflare dns|workers|r2|d1|kv|pages|cache|queues|analytics|stream|ai|access|email for resource operations.",
  );
  await ctx.replyMarkdown(lines.join("\n"));
}

async function getActiveConnection(ctx: TelegramContext, layer: ConnectionsLayer): Promise<{ id: string; name: string } | null> {
  const active = layer.manager.getActiveConnection(ctx.user!.id);
  if (!active || active.provider !== "Cloudflare") {
    await ctx.replyText("No active Cloudflare connection. Use /switch to select one.");
    return null;
  }
  return { id: active.id, name: active.name };
}

async function handleStatus(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveConnection(ctx, layer);
  if (!conn) return;

  await ctx.sendTyping();
  const health = await layer.manager.checkHealth(conn.id, ctx.user!.id);
  await ctx.replyMarkdown(`☁️ *${conn.name}* health: \`${health}\``);
}

async function handleValidate(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveConnection(ctx, layer);
  if (!conn) return;

  await ctx.sendTyping();
  const result = await layer.manager.validate(conn.id, ctx.user!.id);
  if (result.valid) {
    await ctx.replyMarkdown(`☁️ *${conn.name}* validation: ✅ passed`);
  } else {
    const details = result.errors?.join("\n") ?? "Unknown error";
    await ctx.replyMarkdown(`☁️ *${conn.name}* validation: ❌ failed\n\`\`\`\n${details}\n\`\`\``);
  }
}

async function handleInfo(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveConnection(ctx, layer);
  if (!conn) return;

  await ctx.sendTyping();
  const full = layer.manager.get(conn.id);
  if (!full) return;

  const provider = layer.providerRegistry.get("Cloudflare");
  if (!(provider instanceof CloudflareProviderPlugin)) return;

  const credentials = await layer.credentialManager.decryptCredentials(full.encryptedCredentials);
  const { metadata } = await provider.getMetadata(credentials);

  const card = cloudflareCard(conn.name, metadata, full.health);
  const keyboard = connectionDetailKeyboard("cloudflare");
  await ctx.replyMarkdown(card, { reply_markup: keyboard });
}

async function handleReconnect(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveConnection(ctx, layer);
  if (!conn) return;

  await ctx.sendTyping();
  const health = await layer.manager.checkHealth(conn.id, ctx.user!.id);
  const status = health === "healthy" ? "✅ reconnected" : "❌ failed";
  await ctx.replyMarkdown(`☁️ *${conn.name}* reconnect: ${status} (health: \`${health}\`)`);
}

async function handleResourceCommand(ctx: TelegramContext, layer: ConnectionsLayer, resource: string, args: string[]): Promise<void> {
  const conn = await getActiveConnection(ctx, layer);
  if (!conn) return;

  const full = layer.manager.get(conn.id);
  if (!full) return;

  const provider = layer.providerRegistry.get("Cloudflare");
  if (!(provider instanceof CloudflareProviderPlugin)) return;

  await ctx.sendTyping();
  const api = provider.createResourceApi(await layer.credentialManager.decryptCredentials(full.encryptedCredentials));
  await resourceHandlers[resource]!(ctx, api, args);
}
