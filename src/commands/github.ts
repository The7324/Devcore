import type { TelegramCommand, TelegramContext } from "@/telegram/types";
import type { ConnectionsLayer } from "@/connections";
import { Permission } from "@/auth/types";
import { GitHubProviderPlugin } from "@/providers/github/plugin";
import type { GitHubManager } from "@/providers/github/manager";
import {
  repoListMarkdown, repoListKeyboard,
  repoDetailMarkdown, repoDetailKeyboard,
  searchResultsMarkdown, searchResultsKeyboard,
  favoritesMarkdown, recentsMarkdown,
} from "@/commands/github.ui";
import {
  githubCard, validationProgressMarkdown, connectionDetailKeyboard,
  repoStatsMarkdown,
} from "@/providers/github/ui";
import { inlineKeyboard, dataButton } from "@/telegram/buttons";

const GH_PLUGIN = "GitHub";

async function getManager(
  ctx: TelegramContext,
  layer: ConnectionsLayer,
): Promise<GitHubManager | null> {
  const conn = layer.manager.getActiveConnection(ctx.user!.id);
  if (!conn || conn.provider !== GH_PLUGIN) {
    await ctx.replyText("No active GitHub connection. Use /switch to select one.");
    return null;
  }
  const provider = layer.providerRegistry.get(GH_PLUGIN);
  if (!(provider instanceof GitHubProviderPlugin)) return null;
  const credentials = await layer.credentialManager.decryptCredentials(conn.encryptedCredentials);
  return provider.createManager(credentials);
}

export function createGitHubCommand(layer: ConnectionsLayer): TelegramCommand {
  const handler = new GitHubCommandHandler(layer);
  return {
    meta: {
      name: "github",
      description: "GitHub repository manager",
      aliases: ["gh"],
      usage:
        "/github — show status\n"
        + "/github repos — list repositories\n"
        + "/github search <query> — search repositories\n"
        + "/github info — account & metadata\n"
        + "/github stats — repository statistics\n"
        + "/github recent — recent repositories\n"
        + "/github favorites — favorite repositories\n"
        + "/github status — connection status\n"
        + "/github reconnect — refresh connection",
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
        case "repos": case "list": case "ls": await handler.repos(ctx); break;
        case "search": case "find": await handler.search(ctx, args.slice(1).join(" ")); break;
        case "info": await handler.info(ctx); break;
        case "stats": case "statistics": await handler.stats(ctx); break;
        case "recent": case "history": await handler.recent(ctx); break;
        case "favorites": case "favs": await handler.favorites(ctx); break;
        case "status": await handler.status(ctx); break;
        case "reconnect": await handler.reconnect(ctx); break;
        default: await handler.status(ctx);
      }
    },
  };
}

class GitHubCommandHandler {
  private ghCache = new Map<number, GitHubManager>();
  private lastOwner = new Map<number, string>();
  private searchPage = new Map<number, number>();

  constructor(private readonly layer: ConnectionsLayer) {}

  private async getGh(ctx: TelegramContext): Promise<GitHubManager | null> {
    const cached = this.ghCache.get(ctx.user!.id);
    if (cached) return cached;
    const gh = await getManager(ctx, this.layer);
    if (gh) this.ghCache.set(ctx.user!.id, gh);
    return gh;
  }

  private async ensureConnection(ctx: TelegramContext): Promise<GitHubManager | null> {
    const conn = this.layer.manager.getActiveConnection(ctx.user!.id);
    if (!conn || conn.provider !== GH_PLUGIN) {
      await ctx.replyText("No active GitHub connection. Use /switch to select one.");
      return null;
    }
    return this.getGh(ctx);
  }

  async status(ctx: TelegramContext): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    await ctx.sendTyping();
    try {
      const metadata = await gh.getMetadata();
      const health = gh.getHealthRecord();
      const healthStatus = health.lastError ? "error" : health.latency > 2000 ? "warning" : "healthy";
      const conn = this.layer.manager.getActiveConnection(ctx.user!.id)!;
      const md = githubCard(conn.name, metadata, healthStatus);
      await ctx.replyMarkdown(md, {
        reply_markup: connectionDetailKeyboard("gh"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async repos(ctx: TelegramContext): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    await ctx.sendTyping();
    try {
      const metadata = await gh.getMetadata().catch(() => null);
      const owner = metadata?.username ?? "owner";
      this.lastOwner.set(ctx.user!.id, owner);
      const repos = await gh.getRepositories(owner);
      const pub = repos.filter((r) => !r.private);
      const priv = repos.filter((r) => r.private);
      await ctx.replyMarkdown(
        repoListMarkdown(repos, `Repositories (${pub.length} public, ${priv.length} private)`),
        { reply_markup: repoListKeyboard("gh", false) },
      );
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async search(ctx: TelegramContext, query: string): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    if (!query) { await ctx.replyText("Usage: /github search <query>"); return; }
    await ctx.sendTyping();
    try {
      this.searchPage.set(ctx.user!.id, 1);
      const result = await gh.searchRepositories(query);
      await ctx.replyMarkdown(
        searchResultsMarkdown(result.items, query, result.totalCount),
        { reply_markup: searchResultsKeyboard("gh", result.totalCount > result.items.length) },
      );
    } catch (e) {
      await ctx.replyText(`❌ Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async info(ctx: TelegramContext): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    await ctx.sendTyping();
    try {
      const metadata = await gh.getMetadata();
      const health = gh.getHealthRecord();
      const healthStatus = health.lastError ? "error" : "healthy";
      const conn = this.layer.manager.getActiveConnection(ctx.user!.id)!;
      await ctx.replyMarkdown(githubCard(conn.name, metadata, healthStatus), {
        reply_markup: connectionDetailKeyboard("gh"),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async stats(ctx: TelegramContext): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    await ctx.sendTyping();
    try {
      const s = await gh.getStats();
      await ctx.replyMarkdown(repoStatsMarkdown(s), {
        reply_markup: inlineKeyboard([[dataButton("🔙 Back", "gh:back")]]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async reconnect(ctx: TelegramContext): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    await ctx.sendTyping();
    try {
      const steps = await gh.validate();
      await ctx.replyMarkdown(validationProgressMarkdown(steps, "🔄 Reconnecting..."), {
        reply_markup: inlineKeyboard([[dataButton("✅ Done", "gh:back")]]),
      });
    } catch (e) {
      await ctx.replyText(`❌ Reconnect failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async recent(ctx: TelegramContext): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    const items = gh.getRecents();
    await ctx.replyMarkdown(recentsMarkdown(items), {
      reply_markup: inlineKeyboard([[dataButton("🔙 Back", "gh:back")]]),
    });
  }

  async favorites(ctx: TelegramContext): Promise<void> {
    const gh = await this.ensureConnection(ctx);
    if (!gh) return;
    const items = gh.getFavorites();
    await ctx.replyMarkdown(favoritesMarkdown(items), {
      reply_markup: inlineKeyboard([[dataButton("🔙 Back", "gh:back")]]),
    });
  }

  // ── Callback Handler ──

  async handleCallback(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data ?? "";
    const parts = data.split(":");
    if (parts[0] !== "gh" || !parts[1]) return;
    const action = parts[1]!;
    const gh = await this.getGh(ctx);
    if (!gh) return;

    switch (action) {
      case "validate": {
        await ctx.sendTyping();
        try {
          const steps = await gh.validate();
          await ctx.editMessage(validationProgressMarkdown(steps), {
            reply_markup: inlineKeyboard([[dataButton("✅ Done", "gh:back")]]),
          });
        } catch { await ctx.answerCallback("Validation failed", true); }
        break;
      }

      case "health": {
        await ctx.sendTyping();
        const health = gh.getHealthRecord();
        const healthStatus = health.lastError ? "error" : health.latency > 2000 ? "warning" : "healthy";
        await ctx.editMessage(`*✅ GitHub Health*\n\nStatus: \`${healthStatus}\`\nLatency: ${health.latency}ms\nLast: ${health.lastConnected ?? "—"}`, {
          reply_markup: inlineKeyboard([[dataButton("🔙 Back", "gh:back")]]),
        });
        break;
      }

      case "info": {
        await ctx.sendTyping();
        try {
          const metadata = await gh.getMetadata();
          const conn = this.layer.manager.getActiveConnection(ctx.user!.id)!;
          await ctx.editMessage(githubCard(conn.name, metadata, "healthy"), {
            reply_markup: connectionDetailKeyboard("gh"),
          });
        } catch { await ctx.answerCallback("Failed", true); }
        break;
      }

      case "repos": {
        await ctx.sendTyping();
        try {
          const metadata = await gh.getMetadata().catch(() => null);
          const owner = metadata?.username ?? this.lastOwner.get(ctx.user!.id) ?? "owner";
          this.lastOwner.set(ctx.user!.id, owner);
          const repos = await gh.getRepositories(owner);
          const pub = repos.filter((r) => !r.private);
          const priv = repos.filter((r) => r.private);
          await ctx.editMessage(
            repoListMarkdown(repos, `Repositories (${pub.length} public, ${priv.length} private)`),
            { reply_markup: repoListKeyboard("gh", false) },
          );
        } catch { await ctx.answerCallback("Failed", true); }
        break;
      }

      case "search": {
        await ctx.answerCallback("Use /github search <query>");
        break;
      }

      case "search_next": {
        const query = ctx.callbackQuery?.message?.text?.match(/"(.+?)"/)?.[1] ?? "";
        const page = (this.searchPage.get(ctx.user!.id) ?? 1) + 1;
        this.searchPage.set(ctx.user!.id, page);
        await ctx.sendTyping();
        try {
          const result = await gh.searchRepositories(query, page);
          await ctx.editMessage(
            searchResultsMarkdown(result.items, query, result.totalCount),
            { reply_markup: searchResultsKeyboard("gh", result.totalCount > page * 30) },
          );
        } catch { await ctx.answerCallback("Search failed", true); }
        break;
      }

      case "repo": {
        const owner = parts[2] ?? "";
        const repo = parts.slice(3).join(":");
        await ctx.sendTyping();
        try {
          const r = await gh.getRepository(owner, repo);
          gh.addRecent(r);
          await ctx.editMessage(repoDetailMarkdown(r), {
            reply_markup: repoDetailKeyboard(owner, repo, "gh"),
          });
        } catch { await ctx.answerCallback("Repository not found", true); }
        break;
      }

      case "fav": {
        const ownerF = parts[2] ?? "";
        const repoF = parts.slice(3).join(":");
        const r = await gh.getRepository(ownerF, repoF).catch(() => null);
        if (r) {
          const isFav = gh.toggleFavorite(r);
          await ctx.answerCallback(isFav ? "⭐ Added to favorites" : "Removed from favorites");
        }
        break;
      }

      case "open": {
        const ownerO = parts[2] ?? "";
        const repoO = parts.slice(3).join(":");
        await ctx.answerCallback(`https://github.com/${ownerO}/${repoO}`);
        break;
      }

      case "stats": {
        await ctx.sendTyping();
        try {
          const s = await gh.getStats();
          await ctx.editMessage(repoStatsMarkdown(s), {
            reply_markup: inlineKeyboard([[dataButton("🔙 Back", "gh:back")]]),
          });
        } catch { await ctx.answerCallback("Failed", true); }
        break;
      }

      case "reconnect": {
        await ctx.sendTyping();
        try {
          const steps = await gh.validate();
          await ctx.editMessage(validationProgressMarkdown(steps, "🔄 Reconnecting..."), {
            reply_markup: inlineKeyboard([[dataButton("✅ Done", "gh:back")]]),
          });
        } catch { await ctx.answerCallback("Reconnect failed", true); }
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
