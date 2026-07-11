import type { TelegramCommand } from "@/telegram/types";

export const startCommand: TelegramCommand = {
  meta: {
    name: "start",
    description: "Start the bot and see a welcome message",
    usage: "/start",
  },
  async handle(ctx) {
    const name = ctx.user?.first_name ?? "there";

    await ctx.replyMarkdown(
      `*Welcome to DevCore, ${name}!* 🤖\n\n`
        + "I am your DevOps platform bot.\n\n"
        + "Use /help to see available commands.\n"
        + "Use /ping to check if I am alive.",
    );
  },
};
