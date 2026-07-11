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
      "*/start* — Welcome message and introduction",
      "*/help* — Show this help message",
      "*/ping* — Check if the bot is alive",
      "",
      "_More commands will be added as providers are integrated._",
    ].join("\n");

    await ctx.replyMarkdown(text);
  },
};
