import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import type { TelegramRouter } from "@/telegram/router";
import type { CredentialField } from "@/connections/types";
import { providerSelector } from "@/connections";
import { Permission } from "@/auth/types";

export function createConnectionsCommand(layer: ConnectionsLayer, router: TelegramRouter): TelegramCommand {
  return {
    meta: {
      name: "connections",
      description: "Manage provider connections",
      aliases: ["conn", "providers"],
      usage:
        "/connections — list connections\n"
        + "/connections add — add a new connection\n"
        + "/connections switch <name> — switch active connection\n"
        + "/connections disconnect — deactivate active connection",
    },
    permissions: [Permission.ProvidersView],
    async handle(ctx) {
      if (ctx.callbackQuery) {
        await handleCallback(ctx, layer, router);
        return;
      }

      const subcommand = ctx.commandArgs[0]?.toLowerCase();
      switch (subcommand) {
        case "add":
        case "new":
        case "connect":
          await startAdd(ctx, layer, router);
          break;
        case "switch":
          await handleSwitch(ctx, layer, ctx.commandArgs.slice(1).join(" "));
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

export function createConnectCommand(layer: ConnectionsLayer, router: TelegramRouter): TelegramCommand {
  return {
    meta: {
      name: "connect",
      description: "Add a new provider connection",
      aliases: ["add"],
      usage: "/connect — start the guided connection wizard",
    },
    permissions: [Permission.ProvidersManage],
    async handle(ctx) {
      await startAdd(ctx, layer, router);
    },
  };
}

export function createSwitchCommand(layer: ConnectionsLayer): TelegramCommand {
  return {
    meta: {
      name: "switch",
      description: "Switch the active connection",
      usage: "/switch <name> — switch active connection",
    },
    permissions: [Permission.ProvidersView],
    async handle(ctx) {
      await handleSwitch(ctx, layer, ctx.commandArgs.join(" "));
    },
  };
}

export function createDisconnectCommand(layer: ConnectionsLayer): TelegramCommand {
  return {
    meta: {
      name: "disconnect",
      description: "Deactivate the active connection",
      usage: "/disconnect — deactivate active connection",
    },
    permissions: [Permission.ProvidersView],
    async handle(ctx) {
      await handleDisconnect(ctx, layer);
    },
  };
}

async function handleList(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const connections = layer.manager.getAll();
  if (connections.length === 0) {
    await ctx.replyText("No connections configured yet.\n\nUse /connections add to add your first provider connection.");
    return;
  }

  const active = layer.manager.getActive(ctx.user!.id);
  const lines: string[] = ["*Your Connections*", ""];

  for (const conn of connections) {
    const isActive = active?.connectionId === conn.id;
    const prefix = isActive ? "🟢" : "⚪";
    lines.push(`${prefix} *${conn.name}* — \`${conn.provider}\` (${conn.environment})`);
  }

  lines.push(
    "",
    `Total: ${connections.length} connection${connections.length !== 1 ? "s" : ""}`,
    "",
    "Use /connections add to add a new connection.",
    "Use /connections switch <name> to switch active connection.",
  );

  await ctx.replyMarkdown(lines.join("\n"));
}

async function startAdd(ctx: TelegramContext, layer: ConnectionsLayer, router: TelegramRouter): Promise<void> {
  router.clearPendingAction(ctx.user!.id);
  layer.wizard.cancel(ctx.user!.id);

  const providers = layer.providerRegistry.getMetas();
  if (providers.length === 0) {
    await ctx.replyText("No providers are available.");
    return;
  }

  await ctx.replyKeyboard(
    "*Add a Connection*\n\nSelect a provider:",
    providerSelector(providers, "connections"),
    { parse_mode: "Markdown" },
  );
}

async function handleCallback(ctx: TelegramContext, layer: ConnectionsLayer, router: TelegramRouter): Promise<void> {
  const data = ctx.callbackQuery!.data ?? "";
  const parts = data.split(":");

  if (parts[1] === "select" && parts[2]) {
    const provider = parts[2];
    await ctx.answerCallback();

    layer.wizard.start(ctx.user!.id);
    const state = layer.wizard.setProvider(ctx.user!.id, provider);
    if (!state) {
      await ctx.replyText(`Unknown provider: ${provider}`);
      return;
    }

    await ctx.replyMarkdown(
      `Selected *${provider}*.\n\nSend a *name* for this connection (e.g. "my-account"):`,
    );
    router.setPendingAction(ctx.user!.id, {
      userId: ctx.user!.id,
      handle: (c) => captureName(c, layer, router, provider),
    });
    return;
  }

  await ctx.answerCallback();
}

async function captureName(
  ctx: TelegramContext,
  layer: ConnectionsLayer,
  router: TelegramRouter,
  provider: string,
): Promise<void> {
  const name = ctx.message?.text?.trim();
  if (!name) {
    await ctx.replyText("Please send a valid name.");
    router.setPendingAction(ctx.user!.id, {
      userId: ctx.user!.id,
      handle: (c) => captureName(c, layer, router, provider),
    });
    return;
  }

  const state = layer.wizard.setName(ctx.user!.id, name);
  if (!state) {
    await ctx.replyText("Something went wrong. Start again with /connections add.");
    return;
  }

  const fields = (layer.providerRegistry.getCredentialSchema(provider) ?? []).filter((f) => f.required);
  const credentials: Record<string, string> = {};
  await promptCredential(ctx, layer, router, provider, fields, 0, credentials);
}

async function promptCredential(
  ctx: TelegramContext,
  layer: ConnectionsLayer,
  router: TelegramRouter,
  provider: string,
  fields: CredentialField[],
  index: number,
  credentials: Record<string, string>,
): Promise<void> {
  if (index >= fields.length) {
    await finishAdd(ctx, layer, credentials);
    return;
  }

  const field = fields[index]!;
  await ctx.replyMarkdown(
    `Send *${field.label}*${field.placeholder ? `\n_${field.placeholder}_` : ""}`,
  );
  router.setPendingAction(ctx.user!.id, {
    userId: ctx.user!.id,
    handle: async (c) => {
      const value = c.message?.text?.trim();
      if (!value) {
        await c.replyText(`Please send a valid ${field.label}.`);
        router.setPendingAction(c.user!.id, {
          userId: c.user!.id,
          handle: (c2) => promptCredential(c2, layer, router, provider, fields, index, credentials),
        });
        return;
      }
      credentials[field.key] = value;
      await promptCredential(c, layer, router, provider, fields, index + 1, credentials);
    },
  });
}

async function finishAdd(
  ctx: TelegramContext,
  layer: ConnectionsLayer,
  credentials: Record<string, string>,
): Promise<void> {
  layer.wizard.setCredentials(ctx.user!.id, credentials);
  await ctx.replyText("Validating and saving connection...");

  const saved = await layer.wizard.save(ctx.user!.id);
  if (!saved || saved.error || !saved.connectionId) {
    await ctx.replyText(`Failed to save connection: ${saved?.error ?? "unknown error"}`);
    layer.wizard.cancel(ctx.user!.id);
    return;
  }

  const tested = await layer.wizard.test(ctx.user!.id);
  await layer.manager.activate(saved.connectionId, ctx.user!.id);
  layer.wizard.complete(ctx.user!.id);

  if (tested?.error) {
    await ctx.replyMarkdown(
      `⚠️ Connection *saved* but the health check failed:\n\`${tested.error}\`\n\nIt is now the active connection.`,
    );
    return;
  }

  await ctx.replyMarkdown("✅ Connection saved, verified, and set as active.");
}

async function handleSwitch(ctx: TelegramContext, layer: ConnectionsLayer, name: string): Promise<void> {
  if (!name) {
    const active = layer.manager.getActive(ctx.user!.id);
    if (active) {
      const conn = layer.manager.get(active.connectionId);
      await ctx.replyMarkdown(
        `Current active connection: *${conn?.name ?? "Unknown"}*\n\nUse \`/connections switch <name>\` to switch.`,
      );
    } else {
      await ctx.replyText("No active connection. Use /connections switch <name> to set one.");
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
