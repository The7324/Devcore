import type { TelegramCommand } from "@/telegram/types";

export const helpCommand: TelegramCommand = {
  meta: {
    name: "help",
    description: "Show available commands",
    usage: "/help",
  },
  async handle(ctx) {
    const text = [
      "*DevCore Bot — Available Commands*",
      "",
      "*General*",
      "/start — Welcome message and introduction",
      "/help — Show this help message",
      "/ping — Check if the bot is alive",
      "",
      "*Connections*",
      "/connections — Manage provider connections",
      "",
      "*Cloudflare*",
      "/cloudflare — Cloudflare dashboard",
      "/r2 — R2 object storage",
      "/d1 — D1 SQL database",
      "",
      "*Firebase*",
      "/firebase — Firebase dashboard",
      "/firestore — Firestore database browser",
      "/storage — Cloud Storage file manager",
      "/auth — Firebase Auth user manager",
      "",
      "*GitHub*",
      "/github — Repositories, orgs and search",
      "",
      "_Use /connections to add a provider before using its commands._",
    ].join("\n");

    await ctx.replyMarkdown(text);
  },
};
