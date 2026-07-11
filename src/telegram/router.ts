import type { Logger } from "@/core/logger/logger";
import { TelegramContext } from "@/telegram/context";
import type { TelegramCommand, TelegramUpdate } from "@/telegram/types";
import { extractCommand } from "@/utils/helpers";

export class TelegramRouter {
  private readonly commands = new Map<string, TelegramCommand>();

  constructor(private readonly logger: Logger) {}

  register(command: TelegramCommand): void {
    const name = command.meta.name;
    if (this.commands.has(name)) {
      throw new Error(`Telegram command "${name}" is already registered`);
    }
    this.commands.set(name, command);

    if (command.meta.aliases) {
      for (const alias of command.meta.aliases) {
        if (this.commands.has(alias)) {
          this.logger.warn(`Alias "${alias}" for command "${name}" conflicts with an existing command`);
          continue;
        }
        this.commands.set(alias, command);
      }
    }

    this.logger.info(`Telegram command registered: /${name}`);
  }

  async dispatch(update: TelegramUpdate, botToken: string): Promise<void> {
    const start = Date.now();
    const ctx = new TelegramContext(update, botToken, this.logger);
    const updateId = update.update_id;

    if (update.callback_query) {
      this.logger.info(`Update ${updateId}: callback query`, {
        userId: ctx.user?.id,
        data: update.callback_query.data,
      });
      await this.handleCallback(ctx);
    } else if (ctx.message?.text) {
      this.logger.info(`Update ${updateId}: message`, {
        userId: ctx.user?.id,
        text: ctx.message.text.slice(0, 100),
      });
      await this.handleCommand(ctx);
    } else {
      this.logger.debug(`Update ${updateId}: unhandled type`);
    }

    const elapsed = Date.now() - start;
    this.logger.debug(`Update ${updateId} processed in ${elapsed}ms`);
  }

  private async handleCommand(ctx: TelegramContext): Promise<void> {
    const text = ctx.message?.text;
    if (!text) return;

    const parsed = extractCommand(text);
    if (!parsed) return;

    const command = this.commands.get(parsed.command);
    if (!command) {
      this.logger.debug(`Unknown command: /${parsed.command}`);
      return;
    }

    const ctxWithArgs = new TelegramContext(ctx.update, ctx.botToken, this.logger, parsed.args);

    this.logger.info(`Executing command: /${parsed.command}`, {
      args: parsed.args,
      userId: ctx.user?.id,
    });

    try {
      await command.handle(ctxWithArgs);
    } catch (error) {
      this.logger.error(`Command /${parsed.command} failed`, error);
      await this.safeReply(ctx, `An error occurred while executing /${parsed.command}. Please try again later.`);
    }
  }

  private async handleCallback(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const commandName = parts[0];
    if (!commandName) return;

    const command = this.commands.get(commandName);
    if (!command) {
      this.logger.debug(`Unknown callback command: ${commandName}`);
      return;
    }

    this.logger.info(`Executing callback: ${data}`, { userId: ctx.user?.id });

    try {
      await command.handle(ctx);
    } catch (error) {
      this.logger.error(`Callback ${data} failed`, error);
      await ctx.answerCallback("An error occurred", true);
    }
  }

  private async safeReply(ctx: TelegramContext, message: string): Promise<void> {
    try {
      await ctx.replyText(message);
    } catch {
      this.logger.error("Failed to send error reply");
    }
  }

  get registeredCommands(): TelegramCommand[] {
    const seen = new Set<string>();
    const result: TelegramCommand[] = [];
    for (const [name, cmd] of this.commands) {
      if (!seen.has(name)) {
        seen.add(name);
        result.push(cmd);
      }
    }
    return result;
  }
}
