import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import { FirebaseProviderPlugin } from "@/providers/firebase/plugin";
import type { AuthManager } from "@/providers/firebase/auth/manager";
import {
  userDetailMarkdown, userDetailKeyboard,
  userListMarkdown, userListKeyboard,
  statsMarkdown,
  confirmMarkdown,
  createUserMarkdown,
  updateUserMarkdown,
  claimsMarkdown,
  searchResultsMarkdown,
} from "@/commands/auth.ui";
import { inlineKeyboard, dataButton } from "@/telegram/buttons";

const FB_PLUGIN = "Firebase";

async function getAuth(
  ctx: TelegramContext,
  layer: ConnectionsLayer,
): Promise<AuthManager | null> {
  const conn = layer.manager.getActiveConnection(ctx.user!.id);
  if (!conn || conn.provider !== FB_PLUGIN) {
    await ctx.replyText("No active Firebase connection. Use /switch to select one.");
    return null;
  }
  const provider = layer.providerRegistry.get(FB_PLUGIN);
  if (!(provider instanceof FirebaseProviderPlugin)) return null;
  const credentials = await layer.credentialManager.decryptCredentials(conn.encryptedCredentials);
  return provider.createAuthManager(credentials);
}

export function createAuthCommand(layer: ConnectionsLayer): TelegramCommand {
  const handler = new AuthCommandHandler(layer);
  return {
    meta: {
      name: "auth",
      description: "Firebase Authentication user manager",
      aliases: ["users", "accounts"],
      usage:
        "/auth — show status / stats\n"
        + "/auth list — list users\n"
        + "/auth get <uid> — get user by UID\n"
        + "/auth email <email> — get user by email\n"
        + "/auth phone <phone> — get user by phone\n"
        + "/auth search <query> — search users\n"
        + "/auth create <email> <password> — create user\n"
        + "/auth disable <uid> — disable user\n"
        + "/auth enable <uid> — enable user\n"
        + "/auth delete <uid> — delete user\n"
        + "/auth claims <uid> — view custom claims\n"
        + "/auth set_claim <uid> <key>=<value> — set a custom claim\n"
        + "/auth remove_claim <uid> <key> — remove a custom claim\n"
        + "/auth update <uid> <field>=<value> — update user field (displayName, phone, photoUrl)\n"
        + "/auth stats — auth statistics",
    },
    permissions: [Permission.ProvidersManage],
    async handle(ctx) {
      if (ctx.callbackQuery) {
        await handler.handleCallback(ctx);
        return;
      }
      const args = ctx.commandArgs;
      const sub = args[0]?.toLowerCase();
      switch (sub) {
        case "list": case "ls": await handler.listUsers(ctx); break;
        case "get": case "uid": await handler.getUser(ctx, args[1] ?? ""); break;
        case "email": await handler.getByEmail(ctx, args[1] ?? ""); break;
        case "phone": await handler.getByPhone(ctx, args.slice(1).join(" ")); break;
        case "search": case "find": await handler.search(ctx, args.slice(1).join(" ")); break;
        case "create": case "add": await handler.createUser(ctx, args[1] ?? "", args[2] ?? ""); break;
        case "disable": await handler.disableUser(ctx, args[1] ?? ""); break;
        case "enable": await handler.enableUser(ctx, args[1] ?? ""); break;
        case "delete": case "rm": await handler.deleteUser(ctx, args[1] ?? ""); break;
        case "claims": await handler.viewClaims(ctx, args[1] ?? ""); break;
        case "set_claim": await handler.setClaim(ctx, args[1] ?? "", args.slice(2).join(" ")); break;
        case "remove_claim": await handler.removeClaim(ctx, args[1] ?? "", args[2] ?? ""); break;
        case "update": await handler.updateUser(ctx, args[1] ?? "", args.slice(2)); break;
        case "stats": case "statistics": await handler.stats(ctx); break;
        default: await handler.status(ctx);
      }
    },
  };
}

class AuthCommandHandler {
  private authCache = new Map<number, AuthManager>();

  constructor(private readonly layer: ConnectionsLayer) {}

  private async getAm(ctx: TelegramContext): Promise<AuthManager | null> {
    const cached = this.authCache.get(ctx.user!.id);
    if (cached) return cached;
    const am = await getAuth(ctx, this.layer);
    if (am) this.authCache.set(ctx.user!.id, am);
    return am;
  }

  async status(ctx: TelegramContext): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    await ctx.sendTyping();
    try {
      const s = await am.getStats();
      await ctx.replyMarkdown(statsMarkdown(s), {
        reply_markup: inlineKeyboard([
          [dataButton("👥 List Users", "au:list")],
          [dataButton("🔍 Search", "au:search")],
          [dataButton("📊 Stats", "au:stats")],
          [dataButton("➕ Create", "au:create")],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async listUsers(ctx: TelegramContext, pageToken?: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    await ctx.sendTyping();
    try {
      const result = await am.listUsers(pageToken);
      await ctx.replyMarkdown(userListMarkdown(result.users), {
        reply_markup: userListKeyboard("au", !!result.nextPageToken, result.nextPageToken),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async getUser(ctx: TelegramContext, uid: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid) { await ctx.replyText("Usage: /auth get <uid>"); return; }
    await ctx.sendTyping();
    try {
      const user = await am.getUser(uid);
      await ctx.replyMarkdown(userDetailMarkdown(user), {
        reply_markup: userDetailKeyboard(uid, "au"),
      });
    } catch (e) {
      await ctx.replyText(`❌ User not found: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async getByEmail(ctx: TelegramContext, email: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!email) { await ctx.replyText("Usage: /auth email <email>"); return; }
    await ctx.sendTyping();
    try {
      const user = await am.getUserByEmail(email);
      await ctx.replyMarkdown(userDetailMarkdown(user), {
        reply_markup: userDetailKeyboard(user.localId, "au"),
      });
    } catch (e) {
      await ctx.replyText(`❌ User not found: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async getByPhone(ctx: TelegramContext, phone: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!phone) { await ctx.replyText("Usage: /auth phone <phone>"); return; }
    await ctx.sendTyping();
    try {
      const user = await am.getUserByPhone(phone);
      await ctx.replyMarkdown(userDetailMarkdown(user), {
        reply_markup: userDetailKeyboard(user.localId, "au"),
      });
    } catch (e) {
      await ctx.replyText(`❌ User not found: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async search(ctx: TelegramContext, query: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!query) { await ctx.replyText("Usage: /auth search <query>"); return; }
    await ctx.sendTyping();
    try {
      const result = await am.searchUsers({ query, maxResults: 50 });
      await ctx.replyMarkdown(searchResultsMarkdown(result, query), {
        reply_markup: userListKeyboard("au", !!result.nextPageToken, result.nextPageToken),
      });
    } catch (e) {
      await ctx.replyText(`❌ Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async createUser(ctx: TelegramContext, email: string, password: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!email || !password) { await ctx.replyText("Usage: /auth create <email> <password>"); return; }
    await ctx.sendTyping();
    try {
      const user = await am.createUser({ email, password });
      await ctx.replyMarkdown(createUserMarkdown(user), {
        reply_markup: userDetailKeyboard(user.localId, "au"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Create failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async disableUser(ctx: TelegramContext, uid: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid) { await ctx.replyText("Usage: /auth disable <uid>"); return; }
    await ctx.sendTyping();
    try {
      const result = await am.disableUser(uid);
      await ctx.replyMarkdown(updateUserMarkdown(result, "Disabled"));
    } catch (e) {
      await ctx.replyText(`❌ Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async enableUser(ctx: TelegramContext, uid: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid) { await ctx.replyText("Usage: /auth enable <uid>"); return; }
    await ctx.sendTyping();
    try {
      const result = await am.enableUser(uid);
      await ctx.replyMarkdown(updateUserMarkdown(result, "Enabled"));
    } catch (e) {
      await ctx.replyText(`❌ Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async deleteUser(ctx: TelegramContext, uid: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid) { await ctx.replyText("Usage: /auth delete <uid>"); return; }
    await ctx.sendTyping();
    try {
      await am.deleteUser(uid);
      await ctx.replyMarkdown(`✅ *Deleted*\n\nUser \`${uid}\` has been deleted.`);
    } catch (e) {
      await ctx.replyText(`❌ Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async setClaim(ctx: TelegramContext, uid: string, keyValue: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid || !keyValue || !keyValue.includes("=")) {
      await ctx.replyText("Usage: /auth set_claim <uid> <key>=<value>\nExample: /auth set_claim abc123 role=admin");
      return;
    }
    const eq = keyValue.indexOf("=");
    const key = keyValue.slice(0, eq);
    const val = keyValue.slice(eq + 1);
    if (!key) { await ctx.replyText("Key cannot be empty"); return; }
    await ctx.sendTyping();
    try {
      const parsed: unknown = val === "true" ? true : val === "false" ? false : /^\d+$/.test(val) ? Number(val) : val;
      await am.updateCustomClaims(uid, { [key]: parsed });
      const claims = await am.getCustomClaims(uid);
      await ctx.replyMarkdown(claimsMarkdown(uid, claims), {
        reply_markup: inlineKeyboard([
          [dataButton("👤 User", `au:get:${uid}`)],
          [dataButton("🔑 Set Another", `au:set_claim:${uid}`)],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async removeClaim(ctx: TelegramContext, uid: string, key: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid || !key) { await ctx.replyText("Usage: /auth remove_claim <uid> <key>"); return; }
    await ctx.sendTyping();
    try {
      await am.removeCustomClaims(uid, [key]);
      const claims = await am.getCustomClaims(uid);
      await ctx.replyMarkdown(claimsMarkdown(uid, claims), {
        reply_markup: inlineKeyboard([
          [dataButton("👤 User", `au:get:${uid}`)],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async updateUser(ctx: TelegramContext, uid: string, fields: string[]): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid || fields.length === 0) {
      await ctx.replyText(
        "Usage: /auth update <uid> <field>=<value> ...\n"
        + "Fields: displayName, phone, photoUrl, email\n"
        + "Example: /auth update abc123 displayName=Bob phone=+1234567890",
      );
      return;
    }
    const update: Record<string, string> = {};
    for (const f of fields) {
      const eq = f.indexOf("=");
      if (eq === -1) { await ctx.replyText(`Invalid field format: \`${f}\` — use key=value`); return; }
      const k = f.slice(0, eq);
      const v = f.slice(eq + 1);
      const allowed = ["displayName", "phone", "phoneNumber", "photoUrl", "email"];
      if (!allowed.includes(k)) { await ctx.replyText(`Unknown field: \`${k}\`. Allowed: ${allowed.join(", ")}`); return; }
      update[k === "phone" ? "phoneNumber" : k] = v;
    }
    await ctx.sendTyping();
    try {
      const result = await am.updateUser({ localId: uid, ...update } as any);
      await ctx.replyMarkdown(updateUserMarkdown(result, "Updated"), {
        reply_markup: userDetailKeyboard(uid, "au"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async viewClaims(ctx: TelegramContext, uid: string): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    if (!uid) { await ctx.replyText("Usage: /auth claims <uid>"); return; }
    await ctx.sendTyping();
    try {
      const claims = await am.getCustomClaims(uid);
      await ctx.replyMarkdown(claimsMarkdown(uid, claims), {
        reply_markup: inlineKeyboard([
          [dataButton("👤 User", `au:get:${uid}`)],
          [dataButton("🔑 Set Claim", `au:set_claim:${uid}`)],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async stats(ctx: TelegramContext): Promise<void> {
    const am = await this.getAm(ctx);
    if (!am) return;
    await ctx.sendTyping();
    try {
      const s = await am.getStats();
      await ctx.replyMarkdown(statsMarkdown(s), {
        reply_markup: inlineKeyboard([[dataButton("🔙 Back", "au:back")]]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async handleCallback(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data ?? "";
    const parts = data.split(":");
    if (parts[0] !== "au" || !parts[1]) return;
    const action = parts[1]!;
    const am = await this.getAm(ctx);
    if (!am) return;

    switch (action) {
      case "list": {
        await this.listUsers(ctx);
        break;
      }

      case "next": {
        const pt = parts.slice(2).join(":");
        await this.listUsers(ctx, pt || undefined);
        break;
      }

      case "get": {
        const uid = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const user = await am.getUser(uid);
          await ctx.editMessage(userDetailMarkdown(user), {
            reply_markup: userDetailKeyboard(uid, "au"),
          });
        } catch {
          await ctx.answerCallback("User not found", true);
        }
        break;
      }

      case "disable": {
        const uidD = parts.slice(2).join(":");
        const userD = await am.getUser(uidD);
        await ctx.editMessage(confirmMarkdown("Disable User", uidD, userD.email), {
          reply_markup: inlineKeyboard([
            [dataButton("⚠️ Confirm Disable", `au:confirm_disable:${uidD}`)],
            [dataButton("Cancel", `au:get:${uidD}`)],
          ]),
        });
        break;
      }

      case "confirm_disable": {
        const uidD2 = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const result = await am.disableUser(uidD2);
          await ctx.editMessage(updateUserMarkdown(result, "Disabled"));
        } catch {
          await ctx.answerCallback("Failed", true);
        }
        break;
      }

      case "enable": {
        const uidE = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const result = await am.enableUser(uidE);
          await ctx.editMessage(updateUserMarkdown(result, "Enabled"));
        } catch {
          await ctx.answerCallback("Failed", true);
        }
        break;
      }

      case "delete": {
        const uidDel = parts.slice(2).join(":");
        const userDel = await am.getUser(uidDel);
        await ctx.editMessage(confirmMarkdown("Delete User", uidDel, userDel.email, true), {
          reply_markup: inlineKeyboard([
            [dataButton("⚠️ Confirm Delete", `au:confirm_delete:${uidDel}`)],
            [dataButton("Cancel", `au:get:${uidDel}`)],
          ]),
        });
        break;
      }

      case "confirm_delete": {
        const uidDel2 = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          await am.deleteUser(uidDel2);
          await ctx.editMessage(`✅ *Deleted*\n\nUser \`${uidDel2}\` has been deleted.`);
        } catch {
          await ctx.answerCallback("Failed", true);
        }
        break;
      }

      case "claims": {
        const uidC = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const claims = await am.getCustomClaims(uidC);
          await ctx.editMessage(claimsMarkdown(uidC, claims), {
            reply_markup: inlineKeyboard([
              [dataButton("👤 User", `au:get:${uidC}`)],
              [dataButton("🔑 Set Claim", `au:set_claim:${uidC}`)],
            ]),
          });
        } catch {
          await ctx.answerCallback("Failed", true);
        }
        break;
      }

      case "set_claim": {
        const uidS = parts.slice(2).join(":");
        await ctx.answerCallback("Use: /auth set_claim {uid} <key>=<value>".replace("{uid}", uidS));
        break;
      }

      case "stats": {
        await this.stats(ctx);
        break;
      }

      case "search": {
        await ctx.answerCallback("Use /auth search <query>");
        break;
      }

      case "back": {
        await this.status(ctx);
        break;
      }

      default:
        await ctx.answerCallback("Unknown action", true);
    }
  }
}
