import type { TelegramCommand } from "@/telegram/types";

export const pingCommand: TelegramCommand = {
  meta: {
    name: "ping",
    description: "Check if the bot is alive and responsive",
    usage: "/ping",
  },
  async handle(ctx) {
    const start = Date.now();
    await ctx.sendTyping();
    const elapsed = Date.now() - start;

    await ctx.replyText(
      `🏓 *Pong!*\n\n`
        + `Response time: ${elapsed}ms\n`
        + `Bot is alive and healthy.`,
    );
  },
};
