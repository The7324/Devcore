import type { Context } from "hono";
import type { Logger } from "@/core/logger/logger";
import type { Container } from "@/core/di/container";

export interface CommandMeta {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
}

export interface CommandContext {
  container: Container;
  logger: Logger;
  c: Context;
}

export interface Command {
  meta: CommandMeta;
  execute(ctx: CommandContext): Promise<Response | void>;
}
