import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import type { TelegramRouter } from "@/telegram/router";
import { FirebaseProviderPlugin } from "@/providers/firebase/plugin";
import type { StorageManager } from "@/providers/firebase/storage/manager";
import {
  bucketListMarkdown, bucketSelectorKeyboard,
  folderBrowserMarkdown, folderBrowserKeyboard,
  fileDetailMarkdown, fileDetailKeyboard,
  statsMarkdown,
  searchResultsMarkdown, searchResultsKeyboard,
  favoritesMarkdown, recentsMarkdown,
  uploadPromptMarkdown, confirmDeleteMarkdown, urlMarkdown,
} from "@/commands/storage.ui";
import { inlineKeyboard, dataButton } from "@/telegram/buttons";

const FB_PLUGIN = "Firebase";
const DEFAULT_PAGE_SIZE = 30;

async function getStorage(
  ctx: TelegramContext,
  layer: ConnectionsLayer,
): Promise<StorageManager | null> {
  const conn = layer.manager.getActiveConnection(ctx.user!.id);
  if (!conn || conn.provider !== FB_PLUGIN) {
    await ctx.replyText("No active Firebase connection. Use /switch to select one.");
    return null;
  }
  const provider = layer.providerRegistry.get(FB_PLUGIN);
  if (!(provider instanceof FirebaseProviderPlugin)) return null;
  const credentials = await layer.credentialManager.decryptCredentials(conn.encryptedCredentials);
  return provider.createStorageManager(credentials);
}

export function createStorageCommand(layer: ConnectionsLayer, router?: TelegramRouter): TelegramCommand {
  const handler = new StorageCommandHandler(layer, router);
  return {
    meta: {
      name: "storage",
      description: "Firebase Cloud Storage manager",
      aliases: ["st", "gcs"],
      usage:
        "/storage — show status\n"
        + "/storage files — browse files\n"
        + "/storage upload — upload a file\n"
        + "/storage search <query> — search files\n"
        + "/storage stats — storage statistics\n"
        + "/storage recent — recent items\n"
        + "/storage favorites — favorite items\n"
        + "/storage bucket — list/switch buckets",
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
        case "files": case "browse": case "ls": await handler.browse(ctx, args.slice(1).join("/")); break;
        case "upload": case "up": await handler.upload(ctx); break;
        case "search": case "find": await handler.search(ctx, args.slice(1).join(" ")); break;
        case "stats": case "statistics": await handler.stats(ctx); break;
        case "recent": case "history": await handler.recent(ctx); break;
        case "favorites": case "favs": await handler.favorites(ctx); break;
        case "bucket": case "buckets": await handler.buckets(ctx); break;
        default: await handler.status(ctx);
      }
    },
  };
}

class StorageCommandHandler {
  private stCache = new Map<number, StorageManager>();
  private uploadPrefix = new Map<number, string>();

  constructor(
    private readonly layer: ConnectionsLayer,
    private readonly router?: TelegramRouter,
  ) {}

  private async getSt(ctx: TelegramContext): Promise<StorageManager | null> {
    const cached = this.stCache.get(ctx.user!.id);
    if (cached) return cached;
    const st = await getStorage(ctx, this.layer);
    if (st) this.stCache.set(ctx.user!.id, st);
    return st;
  }

  async status(ctx: TelegramContext): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    await ctx.sendTyping();
    try {
      const bucket = await st.detectDefaultBucket();
      const b = await st.getBucket(bucket);
      const lines = ["*📦 Firebase Storage*", ""];
      lines.push(`Active Bucket: \`${bucket}\``);
      lines.push(`Location: ${b.location}`);
      lines.push(`Storage Class: ${b.storageClass}`);
      lines.push("", "Use /storage files to browse.");
      lines.push("Use /storage upload to upload a file.");
      await ctx.replyMarkdown(lines.join("\n"), {
        reply_markup: inlineKeyboard([
          [dataButton("📁 Browse", "st:files")],
          [dataButton("⬆️ Upload", "st:upload")],
          [dataButton("🔍 Search", "st:search")],
          [dataButton("📊 Stats", "st:stats")],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async buckets(ctx: TelegramContext): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    await ctx.sendTyping();
    try {
      const buckets = await st.listBuckets();
      await ctx.replyMarkdown(bucketListMarkdown(buckets, st.defaultBucket), {
        reply_markup: bucketSelectorKeyboard(buckets, "st"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async browse(ctx: TelegramContext, prefix: string = ""): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    await ctx.sendTyping();
    try {
      const bucket = await st.detectDefaultBucket();
      const result = await st.browse(bucket, prefix, { pageSize: DEFAULT_PAGE_SIZE });
      const nav = st.getNavState(ctx.user!.id);
      const stack = nav?.stack ?? [];
      if (prefix && !stack.includes(prefix)) stack.push(prefix);
      st.setNavState(ctx.user!.id, { userId: ctx.user!.id, bucket, prefix, stack });
      await ctx.replyMarkdown(folderBrowserMarkdown(result, prefix), {
        reply_markup: folderBrowserKeyboard("st", prefix, !!result.nextPageToken, result.nextPageToken),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async upload(ctx: TelegramContext): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    const bucket = await st.detectDefaultBucket().catch(() => "");
    const prefix = this.uploadPrefix.get(ctx.user!.id) ?? "";

    if (this.router) {
      this.router.setPendingAction(ctx.user!.id, {
        userId: ctx.user!.id,
        handle: async (fileCtx) => {
          await this.handleFileUpload(fileCtx, st, bucket, prefix);
        },
      });
    }

    await ctx.replyMarkdown(uploadPromptMarkdown(bucket, prefix), {
      reply_markup: inlineKeyboard([[dataButton("❌ Cancel", "st:back")]]),
    });
  }

  private async handleFileUpload(
    ctx: TelegramContext,
    st: StorageManager,
    bucket: string,
    prefix: string,
  ): Promise<void> {
    const msg = ctx.message;
    const file = msg?.document ?? msg?.photo?.[msg.photo.length - 1] ?? msg?.video ?? msg?.audio;

    if (!file) {
      await ctx.replyText("No file found. Send a file and try again.");
      return;
    }

    const fileId = file.file_id;
    const fileName = msg?.document?.file_name ?? `${fileId}.bin`;
    const mimeType = ("mime_type" in file ? file.mime_type : undefined) ?? "application/octet-stream";

    await ctx.sendTyping();
    try {
      const fileUrl = `https://api.telegram.org/file/bot${ctx.botToken}/${fileId}`;
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const path = prefix ? `${prefix}${fileName}` : fileName;

      const result = await st.uploadFile(bucket, path, blob, mimeType);
      await ctx.replyMarkdown(
        `✅ *Uploaded*\n\n\`${result.path}\`\nSize: ${result.size} bytes`,
        { reply_markup: inlineKeyboard([[dataButton("📂 View", `st:file:${bucket}:${result.path}`)]]) },
      );
    } catch (e) {
      await ctx.replyText(`❌ Upload failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async search(ctx: TelegramContext, query: string): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    if (!query) { await ctx.replyText("Usage: /storage search <query>"); return; }
    await ctx.sendTyping();
    try {
      const bucket = await st.detectDefaultBucket();
      const result = await st.searchFiles(bucket, { query, maxResults: 30 });
      const md = searchResultsMarkdown(result);
      await ctx.replyMarkdown(md, { reply_markup: searchResultsKeyboard("st", bucket) });
    } catch (e) {
      await ctx.replyText(`❌ Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async stats(ctx: TelegramContext): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    await ctx.sendTyping();
    try {
      const bucket = await st.detectDefaultBucket();
      const s = await st.getStats(bucket);
      await ctx.replyMarkdown(statsMarkdown(s));
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async recent(ctx: TelegramContext): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    const items = st.getRecents();
    await ctx.replyMarkdown(recentsMarkdown(items), {
      reply_markup: inlineKeyboard([[dataButton("🔙 Back", "st:back")]]),
    });
  }

  async favorites(ctx: TelegramContext): Promise<void> {
    const st = await this.getSt(ctx);
    if (!st) return;
    const items = st.getFavorites();
    await ctx.replyMarkdown(favoritesMarkdown(items), {
      reply_markup: inlineKeyboard([[dataButton("🔙 Back", "st:back")]]),
    });
  }

  // ── Callback Handler ──

  async handleCallback(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data ?? "";
    const parts = data.split(":");
    if (parts[0] !== "st" || !parts[1]) return;
    const action = parts[1]!;

    const st = await this.getSt(ctx);
    if (!st) return;

    switch (action) {
      case "files": {
        await this.browse(ctx);
        break;
      }

      case "browse": {
        const bucket = parts[2] ?? st.defaultBucket;
        const prefix = parts.slice(3).join(":") ?? "";
        await ctx.sendTyping();
        try {
          const result = await st.browse(bucket, prefix, { pageSize: DEFAULT_PAGE_SIZE });
          const nav = st.getNavState(ctx.user!.id);
          const stack = nav?.stack ?? [];
          if (prefix && !stack.includes(prefix)) stack.push(prefix);
          st.setNavState(ctx.user!.id, { userId: ctx.user!.id, bucket, prefix, stack });
          await ctx.editMessage(folderBrowserMarkdown(result, prefix), {
            reply_markup: folderBrowserKeyboard("st", prefix, !!result.nextPageToken, result.nextPageToken),
          });
        } catch { await ctx.answerCallback("Browse failed", true); }
        break;
      }

      case "next": {
        const nav = st.getNavState(ctx.user!.id);
        if (!nav) return;
        await ctx.sendTyping();
        try {
          const result = await st.browse(nav.bucket, nav.prefix, { pageSize: DEFAULT_PAGE_SIZE, pageToken: nav.pageToken });
          await ctx.editMessage(folderBrowserMarkdown(result, nav.prefix), {
            reply_markup: folderBrowserKeyboard("st", nav.prefix, !!result.nextPageToken, result.nextPageToken),
          });
          st.setNavState(ctx.user!.id, { ...nav, pageToken: result.nextPageToken });
        } catch { await ctx.answerCallback("Navigation failed", true); }
        break;
      }

      case "up": {
        const navUp = st.getNavState(ctx.user!.id);
        if (!navUp) return;
        const stack = [...navUp.stack];
        stack.pop();
        const parent = stack.length > 0 ? stack[stack.length - 1] ?? "" : "";
        await ctx.sendTyping();
        try {
          const result = await st.browse(navUp.bucket, parent, { pageSize: DEFAULT_PAGE_SIZE });
          st.setNavState(ctx.user!.id, { ...navUp, prefix: parent, stack, pageToken: undefined });
          await ctx.editMessage(folderBrowserMarkdown(result, parent), {
            reply_markup: folderBrowserKeyboard("st", parent, !!result.nextPageToken, result.nextPageToken),
          });
        } catch { await ctx.answerCallback("Navigation failed", true); }
        break;
      }

      case "file": {
        const bucket = parts[2] ?? "";
        const path = parts.slice(3).join(":");
        await ctx.sendTyping();
        try {
          const obj = await st.getFile(bucket, path);
          await ctx.editMessage(fileDetailMarkdown(obj, bucket), {
            reply_markup: fileDetailKeyboard(path, bucket, "st"),
          });
        } catch { await ctx.answerCallback("File not found", true); }
        break;
      }

      case "delete": {
        const delPath = parts.slice(2).join(":");
        await ctx.editMessage(confirmDeleteMarkdown(delPath), {
          reply_markup: inlineKeyboard([
            [dataButton("⚠️ Confirm Delete", `st:confirm_delete:${delPath}`)],
            [dataButton("Cancel", `st:back`)],
          ]),
        });
        break;
      }

      case "confirm_delete": {
        const delPath2 = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const bucket = st.defaultBucket;
          await st.deleteFile(bucket, delPath2);
          await ctx.editMessage(`✅ *Deleted*\n\n\`${delPath2}\``);
        } catch { await ctx.answerCallback("Delete failed", true); }
        break;
      }

      case "dup": {
        const dupPath = parts.slice(2).join(":");
        await ctx.sendTyping();
        try {
          const bucket = st.defaultBucket;
          const obj = await st.duplicateFile(bucket, dupPath);
          const name = obj.name.split("/").pop() ?? "";
          await ctx.editMessage(`✅ *Duplicated*\n\nNew file: \`${name}\``);
        } catch { await ctx.answerCallback("Duplicate failed", true); }
        break;
      }

      case "url": {
        const urlPath = parts.slice(2).join(":");
        await ctx.sendTyping();
        const bucket = st.defaultBucket;
        const url = st.getDownloadUrl(bucket, urlPath);
        await ctx.editMessage(urlMarkdown(url, bucket, urlPath), {
          reply_markup: inlineKeyboard([[dataButton("🔙 Back", `st:file:${bucket}:${urlPath}`)]]),
        });
        break;
      }

      case "rename": {
        await ctx.answerCallback("Use /storage browse then tap a file and select Rename");
        break;
      }

      case "copy": {
        await ctx.answerCallback("Use /storage browse then tap a file and select Copy");
        break;
      }

      case "fav": {
        const favPath = parts.slice(2).join(":");
        const favName = favPath.split("/").pop() ?? favPath;
        const isFav = st.toggleFavorite("file", favPath, favName);
        await ctx.answerCallback(isFav ? "⭐ Added" : "Removed");
        break;
      }

      case "upload": {
        const navUp2 = st.getNavState(ctx.user!.id);
        const upPrefix = navUp2?.prefix ?? "";
        this.uploadPrefix.set(ctx.user!.id, upPrefix);
        await this.upload(ctx);
        break;
      }

      case "search": {
        await ctx.answerCallback("Use /storage search <query>");
        break;
      }

      case "stats": {
        await this.stats(ctx);
        break;
      }

      case "select_bucket": {
        const bucketName = parts.slice(2).join(":");
        st.setDefaultBucket(bucketName);
        await ctx.answerCallback(`Bucket: ${bucketName}`);
        await ctx.editMessage(`✅ Bucket set to \`${bucketName}\``, {
          reply_markup: inlineKeyboard([[dataButton("📁 Browse", `st:browse:${bucketName}:`)]]),
        });
        break;
      }

      case "back": {
        const navBack = st.getNavState(ctx.user!.id);
        if (navBack) await this.browse(ctx);
        else await this.status(ctx);
        break;
      }

      default:
        await ctx.answerCallback("Unknown action", true);
    }
  }
}
