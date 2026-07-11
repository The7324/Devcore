import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import { FirebaseProviderPlugin } from "@/providers/firebase/plugin";
import {
  projectInfoMarkdown,
  healthDetailMarkdown,
  capabilitiesKeyboard,
  reconnectConfirmationMarkdown,
} from "@/commands/firebase.ui";
import { inlineKeyboard, dataButton } from "@/telegram/buttons";

const FB_PLUGIN = "Firebase";

async function getActiveFirebaseConn(ctx: TelegramContext, layer: ConnectionsLayer) {
  const conn = layer.manager.getActiveConnection(ctx.user!.id);
  if (!conn || conn.provider !== FB_PLUGIN) {
    await ctx.replyText("No active Firebase connection. Use /switch to select one.");
    return null;
  }
  return conn;
}

async function getFirebasePlugin(layer: ConnectionsLayer): Promise<FirebaseProviderPlugin | null> {
  const provider = layer.providerRegistry.get(FB_PLUGIN);
  if (!(provider instanceof FirebaseProviderPlugin)) return null;
  return provider;
}

async function getDecryptedCredentials(ctx: TelegramContext, layer: ConnectionsLayer) {
  const conn = await getActiveFirebaseConn(ctx, layer);
  if (!conn) return null;
  try {
    return await layer.credentialManager.decryptCredentials(conn.encryptedCredentials);
  } catch {
    await ctx.replyText("Failed to decrypt credentials.");
    return null;
  }
}

export function createFirebaseCommand(layer: ConnectionsLayer): TelegramCommand {
  return {
    meta: {
      name: "firebase",
      description: "Manage Firebase connections and view project info",
      aliases: ["fb"],
      usage:
        "/firebase — list Firebase connections\n"
        + "/firebase status — connection status\n"
        + "/firebase validate — re-validate credentials\n"
        + "/firebase info — project metadata & capabilities\n"
        + "/firebase health — health check\n"
        + "/firebase reconnect — refresh connection",
    },
    permissions: [Permission.ProvidersManage],
    async handle(ctx) {
      const args = ctx.commandArgs;
      const sub = args[0]?.toLowerCase();

      if (ctx.callbackQuery) {
        await handleCallback(ctx, layer);
        return;
      }

      switch (sub) {
        case "status": case "health": await handleHealth(ctx, layer); break;
        case "validate": await handleValidate(ctx, layer); break;
        case "info": await handleInfo(ctx, layer); break;
        case "reconnect": await handleReconnect(ctx, layer); break;
        default: await handleList(ctx, layer);
      }
    },
  };
}

async function handleList(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const result = layer.manager.search({ provider: FB_PLUGIN });
  const connections = result.connections;
  const active = layer.manager.getActiveConnection(ctx.user!.id);

  if (connections.length === 0) {
    await ctx.replyMarkdown(
      "🔥 *Firebase*\n\nNo Firebase connections found.\nUse /add to create one.",
    );
    return;
  }

  const lines = ["🔥 *Firebase Connections*", ""];
  for (const conn of connections) {
    const mark = active && conn.id === active.id ? "🟢 " : "";
    const meta = conn.metadata as Record<string, string> | undefined;
    const projectId = meta?.projectId ?? "";
    lines.push(`${mark}• \`${conn.name}\`${projectId ? ` — ${projectId}` : ""} — ${conn.health}`);
  }
  lines.push("", `${connections.length} connection${connections.length !== 1 ? "s" : ""}`);

  await ctx.replyMarkdown(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [dataButton("🟢 Status", "fb:status")],
      [dataButton("ℹ️ Info", "fb:info")],
      [dataButton("🔄 Validate", "fb:validate")],
    ]),
  });
}

async function handleHealth(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveFirebaseConn(ctx, layer);
  if (!conn) return;

  await ctx.sendTyping();
  try {
    const health = await layer.manager.checkHealth(conn.id, ctx.user!.id);
    const md = healthDetailMarkdown(conn, health);
    await ctx.replyMarkdown(md, { reply_markup: capabilitiesKeyboard("fb") });
  } catch (e) {
    await ctx.replyText(`❌ Health check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

async function handleValidate(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveFirebaseConn(ctx, layer);
  if (!conn) return;

  await ctx.sendTyping();
  try {
    const result = await layer.manager.validate(conn.id, ctx.user!.id);
    if (result.valid) {
      await ctx.replyMarkdown("✅ *Validation Passed*\n\nCredentials are valid and the project is accessible.", {
        reply_markup: capabilitiesKeyboard("fb"),
      });
    } else {
      await ctx.replyMarkdown(`❌ *Validation Failed*\n\n${result.errors?.join("\n") ?? "Unknown error"}`, {
        reply_markup: capabilitiesKeyboard("fb"),
      });
    }
  } catch (e) {
    await ctx.replyText(`❌ Validation error: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

async function handleInfo(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const credentials = await getDecryptedCredentials(ctx, layer);
  if (!credentials) return;

  const plugin = await getFirebasePlugin(layer);
  if (!plugin) return;

  await ctx.sendTyping();
  try {
    const { metadata } = await plugin.getMetadata(credentials);
    const md = projectInfoMarkdown(metadata);
    await ctx.replyMarkdown(md, { reply_markup: capabilitiesKeyboard("fb") });
  } catch (e) {
    await ctx.replyText(`❌ Failed to load project info: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

async function handleReconnect(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveFirebaseConn(ctx, layer);
  if (!conn) return;

  await ctx.replyMarkdown(reconnectConfirmationMarkdown(conn.name), {
    reply_markup: inlineKeyboard([
      [dataButton("✅ Confirm Reconnect", "fb:reconnect_confirm")],
      [dataButton("❌ Cancel", "fb:back")],
    ]),
  });
}

async function handleReconnectConfirm(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const conn = await getActiveFirebaseConn(ctx, layer);
  if (!conn) return;
  await ctx.sendTyping();
  try {
    await layer.manager.checkHealth(conn.id, ctx.user!.id);
    const vResult = await layer.manager.validate(conn.id, ctx.user!.id);
    if (vResult.valid) {
      await ctx.editMessage("✅ *Reconnected*\n\nConnection refreshed and validated.", {
        reply_markup: capabilitiesKeyboard("fb"),
      });
    } else {
      await ctx.editMessage(`⚠️ *Reconnected with warnings*\n\n${vResult.errors?.join("\n") ?? ""}`, {
        reply_markup: capabilitiesKeyboard("fb"),
      });
    }
  } catch {
    await ctx.answerCallback("Reconnect failed", true);
  }
}

async function handleCallback(ctx: TelegramContext, layer: ConnectionsLayer): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const parts = data.split(":");
  if (parts[0] !== "fb" || !parts[1]) return;
  const action = parts[1]!;

  switch (action) {
    case "status":
    case "health": {
      const conn = await getActiveFirebaseConn(ctx, layer);
      if (!conn) return;
      await ctx.sendTyping();
      try {
        const health = await layer.manager.checkHealth(conn.id, ctx.user!.id);
        const md = healthDetailMarkdown(conn, health);
        await ctx.editMessage(md, { reply_markup: capabilitiesKeyboard("fb") });
      } catch {
        await ctx.answerCallback("Health check failed", true);
      }
      break;
    }

    case "validate": {
      const connV = await getActiveFirebaseConn(ctx, layer);
      if (!connV) return;
      await ctx.sendTyping();
      try {
        const result = await layer.manager.validate(connV.id, ctx.user!.id);
        if (result.valid) {
          await ctx.editMessage("✅ *Validation Passed*\n\nCredentials are valid and the project is accessible.", {
            reply_markup: capabilitiesKeyboard("fb"),
          });
        } else {
          await ctx.editMessage(`❌ *Validation Failed*\n\n${result.errors?.join("\n") ?? "Unknown error"}`, {
            reply_markup: capabilitiesKeyboard("fb"),
          });
        }
      } catch {
        await ctx.answerCallback("Validation failed", true);
      }
      break;
    }

    case "info": {
      const credentials = await getDecryptedCredentials(ctx, layer);
      if (!credentials) return;
      const plugin = await getFirebasePlugin(layer);
      if (!plugin) return;
      await ctx.sendTyping();
      try {
        const { metadata } = await plugin.getMetadata(credentials);
        await ctx.editMessage(projectInfoMarkdown(metadata), {
          reply_markup: capabilitiesKeyboard("fb"),
        });
      } catch {
        await ctx.answerCallback("Failed to load project info", true);
      }
      break;
    }

    case "reconnect": {
      const connR = await getActiveFirebaseConn(ctx, layer);
      if (!connR) return;
      await ctx.editMessage(reconnectConfirmationMarkdown(connR.name), {
        reply_markup: inlineKeyboard([
          [dataButton("✅ Confirm Reconnect", "fb:reconnect_confirm")],
          [dataButton("❌ Cancel", "fb:back")],
        ]),
      });
      break;
    }

    case "reconnect_confirm": {
      await handleReconnectConfirm(ctx, layer);
      break;
    }

    case "back": {
      await handleList(ctx, layer);
      break;
    }

    default:
      await ctx.answerCallback("Unknown action", true);
  }
}
