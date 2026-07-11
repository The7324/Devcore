import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import { CloudflareProviderPlugin } from "@/providers/cloudflare/plugin";
import type { R2StorageManager } from "@/providers/cloudflare/r2";
import type { TelegramRouter } from "@/telegram/router";
import {
  bucketListMarkdown, bucketSelectorKeyboard,
  objectListMarkdown, objectBrowserKeyboard,
  objectInfoMarkdown, objectActionKeyboard,
  statsMarkdown, searchResultsMarkdown,
  favoritesMarkdown, uploadPromptMarkdown,
} from "@/commands/r2.ui";
import { inlineKeyboard, dataButton } from "@/telegram/buttons";

const CF_PLUGIN_NAME = "Cloudflare";

async function getR2Manager(ctx: TelegramContext, layer: ConnectionsLayer): Promise<R2StorageManager | null> {
  const conn = layer.manager.getActiveConnection(ctx.user!.id);
  if (!conn || conn.provider !== CF_PLUGIN_NAME) {
    await ctx.replyText("No active Cloudflare connection. Use /switch to select one.");
    return null;
  }
  const provider = layer.providerRegistry.get(CF_PLUGIN_NAME);
  if (!(provider instanceof CloudflareProviderPlugin)) return null;

  const credentials = await layer.credentialManager.decryptCredentials(conn.encryptedCredentials);
  const metadata = { tokenId: conn.metadata?.tokenId };
  return provider.createR2StorageManager(credentials, metadata);
}

export function createR2Command(layer: ConnectionsLayer, router?: TelegramRouter): TelegramCommand {
  const handler = new R2CommandHandler(layer, router);
  return {
    meta: {
      name: "r2",
      description: "Cloudflare R2 Storage Manager",
      aliases: ["storage", "s3"],
      usage:
        "/r2 — show R2 status\n"
        + "/r2 buckets — list and switch buckets\n"
        + "/r2 files [path] — browse files\n"
        + "/r2 upload — upload a file\n"
        + "/r2 search <query> — search objects\n"
        + "/r2 stats — bucket statistics\n"
        + "/r2 recent — recent files\n"
        + "/r2 favorites — favorite files and folders",
    },
    permissions: [Permission.ProvidersManage],
    async handle(ctx) {
      const args = ctx.commandArgs;
      const sub = args[0]?.toLowerCase();

      if (ctx.callbackQuery) {
        await handler.handleCallback(ctx);
        return;
      }

      switch (sub) {
        case "buckets": case "bucket": case "bs": await handler.buckets(ctx); break;
        case "files": case "ls": case "dir": await handler.files(ctx, args.slice(1).join("/")); break;
        case "upload": case "up": await handler.upload(ctx); break;
        case "search": case "find": case "grep": await handler.search(ctx, args.slice(1).join(" ")); break;
        case "stats": case "statistics": await handler.stats(ctx); break;
        case "recent": case "history": await handler.recent(ctx); break;
        case "favorites": case "favs": case "bookmarks": await handler.favorites(ctx); break;
        default: await handler.status(ctx);
      }
    },
  };
}

class R2CommandHandler {
  constructor(
    private readonly layer: ConnectionsLayer,
    private readonly router?: TelegramRouter,
  ) {}

  async getR2(ctx: TelegramContext): Promise<R2StorageManager | null> {
    return getR2Manager(ctx, this.layer);
  }

  async status(ctx: TelegramContext): Promise<void> {
    const r2 = await this.getR2(ctx);
    if (!r2) return;
    await ctx.sendTyping();

    try {
      const buckets = await r2.listBuckets();
      const lines = ["*R2 Storage Manager* ☁️", ""];
      lines.push(`Buckets: ${buckets.length}`);
      lines.push(`Connected: ✅`, "");
      if (buckets.length > 0) {
        const activeNav = this.getActiveBucket(ctx);
        if (activeNav) lines.push(`Active: \`${activeNav}\``);
        lines.push("", "Use /r2 buckets to switch bucket.");
      }
      lines.push("Use /r2 files to browse files.");
      lines.push("Use /r2 upload to upload a file.");
      lines.push("Use /r2 search to find objects.");
      await ctx.replyMarkdown(lines.join("\n"), {
        reply_markup: inlineKeyboard([
          [dataButton("📦 Buckets", "r2:buckets")],
          [dataButton("📁 Files", "r2:files")],
          [dataButton("⬆️ Upload", "r2:upload")],
          [dataButton("📊 Stats", "r2:stats")],
        ]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async buckets(ctx: TelegramContext): Promise<void> {
    const r2 = await this.getR2(ctx);
    if (!r2) return;
    await ctx.sendTyping();

    try {
      const buckets = await r2.listBuckets();
      const active = this.getActiveBucket(ctx);
      const md = bucketListMarkdown(buckets, active ?? undefined);
      await ctx.replyMarkdown(md, { reply_markup: bucketSelectorKeyboard(buckets, "r2") });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async files(ctx: TelegramContext, path?: string): Promise<void> {
    const r2 = await this.getR2(ctx);
    if (!r2) return;
    await ctx.sendTyping();

    const bucket = this.getActiveBucket(ctx);
    if (!bucket) {
      await this.buckets(ctx);
      return;
    }

    const currentPath = path ?? r2.getNavState(ctx.user!.id)?.path ?? "";
    try {
      const list = await r2.listObjects(bucket, currentPath, "/");
      r2.setNavState(ctx.user!.id, { userId: ctx.user!.id, bucket, path: currentPath, page: 0 });
      const md = objectListMarkdown(list, currentPath);
      const kb = objectBrowserKeyboard("r2", currentPath, list, bucket);
      await ctx.replyMarkdown(md, { reply_markup: kb });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async upload(ctx: TelegramContext): Promise<void> {
    const r2 = await this.getR2(ctx);
    if (!r2) return;

    const bucket = this.getActiveBucket(ctx);
    if (!bucket) {
      await this.buckets(ctx);
      return;
    }

    const nav = r2.getNavState(ctx.user!.id);
    const path = nav?.path ?? "";

    if (this.router) {
      const userId = ctx.user!.id;
      this.router.setPendingAction(userId, {
        userId,
        handle: async (fileCtx: TelegramContext) => {
          const r2mgr = await this.getR2(fileCtx);
          if (r2mgr) await this.handleFileMessage(fileCtx, r2mgr);
        },
      });
    }

    r2.setUploadState(ctx.user!.id, {
      userId: ctx.user!.id, bucket, path, fileName: "", overwrite: false, startedAt: Date.now(),
    });

    await ctx.replyMarkdown(uploadPromptMarkdown(bucket, path), {
      reply_markup: inlineKeyboard([[dataButton("❌ Cancel", "r2:cancel_upload")]]),
    });
  }

  async search(ctx: TelegramContext, query: string): Promise<void> {
    if (!query) {
      await ctx.replyText("Usage: /r2 search <query>");
      return;
    }
    const r2 = await this.getR2(ctx);
    if (!r2) return;
    await ctx.sendTyping();

    const bucket = this.getActiveBucket(ctx);
    if (!bucket) { await this.buckets(ctx); return; }

    try {
      const results = await r2.search(bucket, { query, limit: 100 });
      const md = searchResultsMarkdown(results, query);
      await ctx.replyMarkdown(md);
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async stats(ctx: TelegramContext): Promise<void> {
    const r2 = await this.getR2(ctx);
    if (!r2) return;
    await ctx.sendTyping();

    const bucket = this.getActiveBucket(ctx);
    if (!bucket) { await this.buckets(ctx); return; }

    try {
      const s = await r2.getStats(bucket);
      await ctx.replyMarkdown(statsMarkdown(s));
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async recent(ctx: TelegramContext): Promise<void> {
    const r2 = await this.getR2(ctx);
    if (!r2) return;

    const items = r2.getRecent(ctx.user!.id);
    if (items.length === 0) {
      await ctx.replyText("No recent files.");
      return;
    }

    const lines = ["*Recent Files*", ""];
    for (const item of items) {
      lines.push(`• \`${item.key}\` — \`${item.bucket}\` (${item.timestamp.slice(0, 10)})`);
    }
    await ctx.replyMarkdown(lines.join("\n"));
  }

  async favorites(ctx: TelegramContext): Promise<void> {
    const r2 = await this.getR2(ctx);
    if (!r2) return;

    const favs = r2.listFavorites(ctx.user!.id);
    await ctx.replyMarkdown(favoritesMarkdown(favs.folders, favs.files));
  }

  // ── Callback handler ──

  async handleCallback(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data ?? "";
    const parts = data.split(":");
    if (parts[0] !== "r2" || !parts[1]) return;

    const action = parts[1]!;
    const r2 = await this.getR2(ctx);
    if (!r2) return;

    switch (action) {
      case "buckets": await this.buckets(ctx); break;
      case "files": await this.files(ctx); break;
      case "select": {
        const bucket = parts.slice(2).join(":");
        this.setActiveBucket(ctx, bucket);
        await ctx.answerCallback(`Switched to ${bucket}`);
        r2.setNavState(ctx.user!.id, { userId: ctx.user!.id, bucket, path: "", page: 0 });
        await this.files(ctx);
        break;
      }
      case "new": {
        await ctx.answerCallback("Use /r2 create <name> to create a bucket");
        break;
      }
      case "cd": {
        const path = parts.slice(2).join(":").replace(/^\/?/, "").replace(/\/?$/, "") + "/";
        const bucket = this.getActiveBucket(ctx);
        if (!bucket) return;
        r2.setNavState(ctx.user!.id, { userId: ctx.user!.id, bucket, path, page: 0 });
        await this.files(ctx);
        break;
      }
      case "info": {
        const key = parts.slice(2).join(":");
        const bucket = this.getActiveBucket(ctx);
        if (!bucket) return;
        try {
          const obj = await r2.listObjects(bucket, key);
          const file = obj.objects.find((o) => o.key === key);
          if (!file) { await ctx.answerCallback("Object not found"); return; }
          r2.addRecent(ctx.user!.id, bucket, key);
          await ctx.editMessage(objectInfoMarkdown(file, bucket), {
            reply_markup: objectActionKeyboard("r2", key),
          });
        } catch { await ctx.answerCallback("Error loading object info", true); }
        break;
      }
      case "delete": {
        const delKey = parts.slice(2).join(":");
        const bucket = this.getActiveBucket(ctx);
        if (!bucket) return;
        await ctx.editMessage(`Delete \`${delKey}\`?`, {
          reply_markup: inlineKeyboard([
            [dataButton("✅ Confirm", `r2:confirm_delete:${delKey}`)],
            [dataButton("❌ Cancel", "r2:back")],
          ]),
        });
        break;
      }
      case "confirm_delete": {
        const confirmKey = parts.slice(2).join(":");
        const bucket = this.getActiveBucket(ctx);
        if (!bucket) return;
        await ctx.sendTyping();
        try {
          await r2.deleteObject(bucket, confirmKey);
          await ctx.answerCallback("Deleted ✅");
          await this.files(ctx);
        } catch (e) {
          await ctx.answerCallback(`Delete failed: ${e instanceof Error ? e.message : "Error"}`, true);
        }
        break;
      }
      case "copy":
      case "move":
      case "rename": {
        await ctx.answerCallback(`Use /r2 ${action} <source> <dest> for now`);
        break;
      }
      case "sign": {
        const signKey = parts.slice(2).join(":");
        const bucket = this.getActiveBucket(ctx);
        if (!bucket) return;
        try {
          const url = await r2.generateSignedUrl(bucket, { key: signKey, expiresIn: 3600 });
          await ctx.editMessage(
                `🔗 *Signed URL* (1 hour)\n\n\`${url}\``,
            { reply_markup: inlineKeyboard([[dataButton("🔙 Back", "r2:back")]]) },
          );
        } catch (e) {
          await ctx.answerCallback(`Signed URL failed: ${e instanceof Error ? e.message : "Error"}`, true);
        }
        break;
      }
      case "fav": {
        const favKey = parts.slice(2).join(":");
        r2.addFavorite(ctx.user!.id, favKey, true);
        await ctx.answerCallback("⭐ Added to favorites");
        break;
      }
      case "upload": {
        await this.upload(ctx);
        break;
      }
      case "search": {
        await ctx.answerCallback("Use /r2 search <query>");
        break;
      }
      case "stats": {
        await this.stats(ctx);
        break;
      }
      case "back": {
        await this.files(ctx);
        break;
      }
      case "cancel_upload": {
        r2.clearUploadState(ctx.user!.id);
        await ctx.editMessage("Upload cancelled.");
        break;
      }
      default:
        await ctx.answerCallback("Unknown action", true);
    }
  }

  // ── Active bucket per-user ──

  private activeBuckets = new Map<number, string>();

  private getActiveBucket(ctx: TelegramContext): string | undefined {
    const nav = this.layer.manager.getActiveConnection(ctx.user!.id);
    if (nav) {
      const r2 = this.getR2FromCache(ctx);
      if (r2) {
        const state = r2.getNavState(ctx.user!.id);
        if (state?.bucket) {
          this.activeBuckets.set(ctx.user!.id, state.bucket);
          return state.bucket;
        }
      }
    }
    return this.activeBuckets.get(ctx.user!.id);
  }

  private setActiveBucket(ctx: TelegramContext, bucket: string): void {
    this.activeBuckets.set(ctx.user!.id, bucket);
  }

  private r2Cache = new Map<number, R2StorageManager>();

  private getR2FromCache(ctx: TelegramContext): R2StorageManager | null {
    return this.r2Cache.get(ctx.user!.id) ?? null;
  }

  private async handleFileMessage(ctx: TelegramContext, r2mgr: R2StorageManager): Promise<void> {
    const upload = r2mgr.getUploadState(ctx.user!.id);
    if (!upload) return;

    const fileId = ctx.message?.document?.file_id
      ?? ctx.message?.photo?.[ctx.message.photo.length - 1]?.file_id
      ?? ctx.message?.video?.file_id
      ?? ctx.message?.audio?.file_id;
    const fileName = ctx.message?.document?.file_name ?? `upload_${Date.now()}`;
    const mimeType = ctx.message?.document?.mime_type
      ?? (ctx.message?.photo ? "image/jpeg" : undefined)
      ?? (ctx.message?.video ? "video/mp4" : undefined)
      ?? (ctx.message?.audio ? ctx.message.audio.mime_type : undefined);

    if (!fileId) {
      await ctx.replyText("No file found in message. Send a document, photo, video, or audio file.");
      return;
    }

    await ctx.sendTyping();

    try {
      const fileUrl = `https://api.telegram.org/file/bot${ctx.botToken}/${await getFilePath(ctx.botToken, fileId)}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);

      const blob = await response.blob();
      const key = upload.path + fileName;
      await r2mgr.uploadObject(upload.bucket, key, blob, mimeType);
      r2mgr.addRecent(ctx.user!.id, upload.bucket, key);
      r2mgr.clearUploadState(ctx.user!.id);

      await ctx.replyMarkdown(`✅ Uploaded \`${key}\` to \`${upload.bucket}\` (${formatBytes(blob.size)})`);
    } catch (e) {
      await ctx.replyText(`❌ Upload failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }
}

async function getFilePath(botToken: string, fileId: string): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const json = await res.json() as { ok: boolean; result?: { file_path?: string } };
  if (!json.ok || !json.result?.file_path) throw new Error("Failed to get file path");
  return json.result.file_path;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
