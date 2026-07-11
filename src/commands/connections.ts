import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";

export function createConnectionsCommand(layer: ConnectionsLayer): TelegramCommand {
  return {
    meta: {
      name: "connections",
      description: "Manage provider connections",
      aliases: ["conn", "providers"],
      usage: "/connections — list connections\n/connect — add new connection\n/switch — switch active connection\n/disconnect — deactivate connection\n/list [filter] — search connections\n/search [query] — search connections",
    },
    permissions: [Permission.ProvidersView],
    async handle(ctx) {
      const args = ctx.commandArgs;
      const subcommand = args[0]?.toLowerCase();

      switch (subcommand) {
        case "list":
        case "ls":
          await handleList(ctx, layer);
          break;
        case "switch":
          await handleSwitch(ctx, layer);
          break;
        case "disconnect":
          await handleDisconnect(ctx, layer);
          break;
        default:
          await handleList(ctx, layer);
      }
    },
  };
}

async function handleList(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const connections = layer.manager.getAll();
  if (connections.length === 0) {
    await ctx.replyText("No connections configured yet.\n\nUse /connect to add your first provider connection.");
    return;
  }

  const active = layer.manager.getActive(ctx.user!.id);
  const lines: string[] = [
    "*Your Connections*",
    "",
  ];

  for (const conn of connections) {
    const isActive = active?.connectionId === conn.id;
    const prefix = isActive ? "🟢" : "⚪";
    lines.push(`${prefix} *${conn.name}* — \`${conn.provider}\` (${conn.environment})`);
  }

  lines.push(
    "",
    `Total: ${connections.length} connection${connections.length !== 1 ? "s" : ""}`,
    "",
    "Use /connect to add a new connection.",
    "Use /switch <name> to switch active connection.",
  );

  await ctx.replyMarkdown(lines.join("\n"));
}

async function handleSwitch(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const args = ctx.commandArgs;
  const name = args.slice(1).join(" ");

  if (!name) {
    const active = layer.manager.getActive(ctx.user!.id);
    if (active) {
      const conn = layer.manager.get(active.connectionId);
      await ctx.replyMarkdown(
        `Current active connection: *${conn?.name ?? "Unknown"}*\n\nUse \`/switch <name>\` to switch to another connection.`,
      );
    } else {
      await ctx.replyText("No active connection. Use /switch <connection-name> to set one.");
    }
    return;
  }

  const results = layer.manager.search({ name, ownerId: ctx.user!.id });
  const conn = results.connections[0];

  if (!conn) {
    await ctx.replyText(`No connection found with name "${name}".`);
    return;
  }

  await layer.manager.activate(conn.id, ctx.user!.id);
  await ctx.replyMarkdown(`🟢 Switched active connection to *${conn.name}*.`);
}

async function handleDisconnect(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const active = layer.manager.getActive(ctx.user!.id);
  if (!active) {
    await ctx.replyText("No active connection to disconnect.");
    return;
  }

  layer.manager.deactivate(ctx.user!.id);
  await ctx.replyText("Disconnected. No active connection selected.");
}
