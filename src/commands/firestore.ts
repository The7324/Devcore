import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import { FirebaseProviderPlugin } from "@/providers/firebase/plugin";
import type { FirestoreManager } from "@/providers/firebase/firestore/manager";
import type { ExecuteQueryOptions } from "@/providers/firebase/firestore/types";
import {
  collectionListMarkdown, collectionListKeyboard,
  documentListMarkdown, documentListKeyboard,
  documentViewMarkdown, documentViewKeyboard,
  queryResultMarkdown, queryResultKeyboard,
  statsMarkdown, confirmDestructiveMarkdown,
  favoritesMarkdown, favoritesKeyboard,
  recentsMarkdown, recentsKeyboard,
  exportFormatKeyboard,
} from "@/commands/firestore.ui";
import { inlineKeyboard, dataButton } from "@/telegram/buttons";

const FB_PLUGIN = "Firebase";

async function getFirestore(
  ctx: TelegramContext,
  layer: ConnectionsLayer,
  userId?: number,
): Promise<FirestoreManager | null> {
  const conn = layer.manager.getActiveConnection(ctx.user!.id);
  if (!conn || conn.provider !== FB_PLUGIN) {
    await ctx.replyText("No active Firebase connection. Use /switch to select one.");
    return null;
  }
  const provider = layer.providerRegistry.get(FB_PLUGIN);
  if (!(provider instanceof FirebaseProviderPlugin)) return null;
  const credentials = await layer.credentialManager.decryptCredentials(conn.encryptedCredentials);
  return provider.createFirestoreManager(credentials, userId ?? ctx.user!.id);
}

export function createFirestoreCommand(layer: ConnectionsLayer): TelegramCommand {
  const handler = new FirestoreCommandHandler(layer);
  return {
    meta: {
      name: "firestore",
      description: "Firebase Firestore database manager",
      aliases: ["fs"],
      usage:
        "/firestore — show status\n"
        + "/firestore collections — list collections\n"
        + "/firestore browse <collection> — browse documents\n"
        + "/firestore query <collection> <field> <op> <value> — query documents\n"
        + "/firestore search <collection> <term> — search documents\n"
        + "/firestore export <collection> — export collection\n"
        + "/firestore stats — database statistics\n"
        + "/firestore recent — recent items\n"
        + "/firestore favorites — favorite items",
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
        case "collections": case "list": await handler.collections(ctx); break;
        case "browse": case "open": await handler.browse(ctx, args.slice(1).join("/")); break;
        case "query": case "find": await handler.query(ctx, args.slice(1)); break;
        case "search": await handler.search(ctx, args.slice(1)); break;
        case "export": await handler.export(ctx, args[1] ?? ""); break;
        case "stats": case "statistics": await handler.stats(ctx); break;
        case "recent": case "history": await handler.recent(ctx); break;
        case "favorites": case "favs": await handler.favorites(ctx); break;
        default: await handler.status(ctx);
      }
    },
  };
}

class FirestoreCommandHandler {
  private fsCache = new Map<number, FirestoreManager>();
  private pageTokens = new Map<string, string>();

  constructor(private readonly layer: ConnectionsLayer) {}

  private async getFs(ctx: TelegramContext): Promise<FirestoreManager | null> {
    const cached = this.fsCache.get(ctx.user!.id);
    if (cached) return cached;
    const fs = await getFirestore(ctx, this.layer, ctx.user!.id);
    if (fs) this.fsCache.set(ctx.user!.id, fs);
    return fs;
  }

  async status(ctx: TelegramContext): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    await ctx.sendTyping();
    try {
      const dbs = await fs.listDatabases();
      const lines = ["*🔥 Firestore Manager*", ""];
      lines.push(`Databases: ${dbs.length}`);
      if (dbs.length > 0) {
        const db = dbs[0]!;
        const name = db.name.split("/").pop() ?? db.name;
        lines.push(`Active: \`${name}\` — ${db.locationId}`);
      }
      lines.push("", "Use /firestore collections to browse.");
      lines.push("Use /firestore browse <collection> to view documents.");
      lines.push("Use /firestore query for structured queries.");
      await ctx.replyMarkdown(lines.join("\n"), {
        reply_markup: inlineKeyboard([
          [dataButton("📁 Collections", "fs:collections")],
          [dataButton("📊 Stats", "fs:stats")],
          [dataButton("⭐ Favorites", "fs:favorites")],
          [dataButton("🕐 Recent", "fs:recent")],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async collections(ctx: TelegramContext): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    await ctx.sendTyping();
    try {
      const collections = await fs.listCollections();
      await ctx.replyMarkdown(collectionListMarkdown(collections), {
        reply_markup: collectionListKeyboard(collections, "fs"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async browse(ctx: TelegramContext, collection: string): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    if (!collection) { await ctx.replyText("Usage: /firestore browse <collection>"); return; }
    await ctx.sendTyping();
    try {
      const result = await fs.browseDocuments(collection);
      const pt = this.pageTokens.get(`${ctx.user!.id}:${collection}`);
      const md = documentListMarkdown(result, collection);
      await ctx.replyMarkdown(md, {
        reply_markup: documentListKeyboard(collection, "fs", !!result.nextPageToken, pt),
      });
      this.pageTokens.set(`${ctx.user!.id}:${collection}_next`, result.nextPageToken ?? "");
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async query(ctx: TelegramContext, args: string[]): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    if (args.length < 1) { await ctx.replyText("Usage: /firestore query <collection> [field] [op] [value]"); return; }
    const collection = args[0]!;
    await ctx.sendTyping();
    try {
      const options: ExecuteQueryOptions = {};
      if (args.length >= 4) {
        options.filters = [{ field: args[1]!, op: args[2]!, value: args.slice(3).join(" ") }];
      }
      const { documents, executionTime } = await fs.executeQuery(collection, options);
      const label = options.filters ? `${args[1]} ${args[2]} ${args.slice(3).join(" ")}` : "all";
      await ctx.replyMarkdown(queryResultMarkdown(documents, label, executionTime), {
        reply_markup: queryResultKeyboard(collection, "fs"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Query failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async search(ctx: TelegramContext, args: string[]): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    if (args.length < 2) { await ctx.replyText("Usage: /firestore search <collection> <term>"); return; }
    const collection = args[0]!;
    const term = args.slice(1).join(" ");
    await ctx.sendTyping();
    try {
      const result = await fs.searchDocuments(collection, { field: "__name__", op: "EQUAL", value: term, limit: 10 });
      await ctx.replyMarkdown(queryResultMarkdown(result.documents, `search: ${term}`, result.executionTime), {
        reply_markup: queryResultKeyboard(collection, "fs"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async export(ctx: TelegramContext, collection: string, path?: string): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    if (!collection) { await ctx.replyText("Usage: /firestore export <collection>"); return; }
    await ctx.replyMarkdown(`*Export* \`${path ?? collection}\` — choose format:`, {
      reply_markup: exportFormatKeyboard("fs", path ?? collection),
    });
  }

  async stats(ctx: TelegramContext): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    await ctx.sendTyping();
    try {
      const s = await fs.getStats();
      await ctx.replyMarkdown(statsMarkdown(s));
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async recent(ctx: TelegramContext): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    const items = fs.getRecents();
    await ctx.replyMarkdown(recentsMarkdown(items), {
      reply_markup: recentsKeyboard("fs"),
    });
  }

  async favorites(ctx: TelegramContext): Promise<void> {
    const fs = await this.getFs(ctx);
    if (!fs) return;
    const items = fs.getFavorites();
    await ctx.replyMarkdown(favoritesMarkdown(items), {
      reply_markup: favoritesKeyboard("fs"),
    });
  }

  // ── Callback Handler ──

  async handleCallback(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data ?? "";
    const parts = data.split(":");
    if (parts[0] !== "fs" || !parts[1]) return;
    const action = parts[1]!;
    const fs = await this.getFs(ctx);
    if (!fs) return;

    switch (action) {
      case "collections": await this.collections(ctx); break;
      case "stats": await this.stats(ctx); break;
      case "favorites": await this.favorites(ctx); break;
      case "recent": await this.recent(ctx); break;

      case "browse": {
        const collection = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const result = await fs.browseDocuments(collection);
          const pt = this.pageTokens.get(`${ctx.user!.id}:${collection}`);
          const md = documentListMarkdown(result, collection);
          await ctx.editMessage(md, {
            reply_markup: documentListKeyboard(collection, "fs", !!result.nextPageToken, pt),
          });
          this.pageTokens.set(`${ctx.user!.id}:${collection}_next`, result.nextPageToken ?? "");
        } catch {
          await ctx.answerCallback("Browse failed", true);
        }
        break;
      }

      case "next":
      case "prev": {
        const coll = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const pageToken = action === "next"
            ? this.pageTokens.get(`${ctx.user!.id}:${coll}_next`)
            : undefined;
          const result = await fs.browseDocuments(coll, { pageToken });
          const md = documentListMarkdown(result, coll);
          const pt = this.pageTokens.get(`${ctx.user!.id}:${coll}`);
          await ctx.editMessage(md, {
            reply_markup: documentListKeyboard(coll, "fs", !!result.nextPageToken, pt),
          });
          this.pageTokens.set(`${ctx.user!.id}:${coll}_next`, result.nextPageToken ?? "");
        } catch {
          await ctx.answerCallback("Navigation failed", true);
        }
        break;
      }

      case "view": {
        const path = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const doc = await fs.getDocument(path);
          const md = documentViewMarkdown(doc);
          await ctx.editMessage(md, { reply_markup: documentViewKeyboard(path, "fs") });
        } catch {
          await ctx.answerCallback("Document not found", true);
        }
        break;
      }

      case "new": {
        await ctx.answerCallback("Use /firestore browse and a command to create: /fs_create <coll> <json>");
        break;
      }

      case "delete": {
        const delPath = parts.slice(2).join(":");
        await ctx.editMessage(confirmDestructiveMarkdown("Delete Document", delPath), {
          reply_markup: inlineKeyboard([
            [dataButton("⚠️ Confirm Delete", `fs:confirm_delete:${delPath}`)],
            [dataButton("Cancel", `fs:view:${delPath}`)],
          ]),
        });
        break;
      }

      case "confirm_delete": {
        const delPath2 = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          await fs.deleteDocument(delPath2);
          await ctx.editMessage(`✅ *Deleted*\n\n\`${delPath2}\``);
        } catch (e) {
          await ctx.answerCallback(`Delete failed: ${e instanceof Error ? e.message : "Error"}`, true);
        }
        break;
      }

      case "dup": {
        const dupPath = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const parts2 = dupPath.split("/");
          const coll = parts2.slice(0, -1).join("/");
          const doc = await fs.duplicateDocument(dupPath, coll);
          const id = doc.name.split("/").pop() ?? "";
          await ctx.editMessage(`✅ *Duplicated*\n\nNew document: \`${id}\``);
        } catch (e) {
          await ctx.answerCallback(`Duplicate failed: ${e instanceof Error ? e.message : "Error"}`, true);
        }
        break;
      }

      case "fav": {
        const favPath = parts.slice(2).join(":");
        const favId = favPath.split("/").pop() ?? favPath;
        const isFav = fs.toggleFavorite("document", favPath, favId);
        await ctx.answerCallback(isFav ? "⭐ Added to favorites" : "Removed from favorites");
        break;
      }

      case "export": {
        const expColl = parts.slice(2).join(":");
        await this.export(ctx, expColl);
        break;
      }

      case "exp_doc": {
        const expDocPath = parts.slice(2).join(":");
        await this.export(ctx, expDocPath, expDocPath);
        break;
      }

      case "do_export": {
        const expTarget = parts.slice(2, -1).join(":");
        const expFmt = parts[parts.length - 1] ?? "json";
        const isDoc = parts.length > 3;
        await ctx.sendTyping();
        try {
          const data = isDoc
            ? await fs.exportDocument(expTarget, expFmt as "json" | "csv")
            : await fs.exportCollection(expTarget, expFmt as "json" | "csv");
          const maxLen = 3500;
          const content = data.length > maxLen
            ? data.slice(0, maxLen) + `\n… (truncated, ${data.length} total chars)`
            : data;
          await ctx.replyMarkdown(`📥 *Export (${expFmt})*\n\n\`\`\`\n${content}\n\`\`\``);
        } catch (e) {
          await ctx.answerCallback(`Export failed: ${e instanceof Error ? e.message : "Error"}`, true);
        }
        break;
      }

      case "query": {
        const qColl = parts.slice(2).join(":");
        await ctx.answerCallback(`Use /firestore query ${qColl} <field> <op> <value>`);
        break;
      }

      case "search": {
        await ctx.answerCallback("Use /firestore search <collection> <term>");
        break;
      }

      case "fav_collections": {
        const favColls = fs.getFavorites("collection");
        await ctx.editMessage(favoritesMarkdown(favColls), { reply_markup: favoritesKeyboard("fs") });
        break;
      }

      case "fav_documents": {
        const favDocs = fs.getFavorites("document");
        await ctx.editMessage(favoritesMarkdown(favDocs), { reply_markup: favoritesKeyboard("fs") });
        break;
      }

      case "rec_collections": {
        const recColls = fs.getRecents("collection");
        await ctx.editMessage(recentsMarkdown(recColls), { reply_markup: recentsKeyboard("fs") });
        break;
      }

      case "rec_documents": {
        const recDocs = fs.getRecents("document");
        await ctx.editMessage(recentsMarkdown(recDocs), { reply_markup: recentsKeyboard("fs") });
        break;
      }

      case "back": {
        await this.collections(ctx);
        break;
      }

      default:
        await ctx.answerCallback("Unknown action", true);
    }
  }
}
